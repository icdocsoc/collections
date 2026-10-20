/**
 * Script to import merch for the summer 2026 drop, done
 * via pre-orders from SUMS.
 */
import { AcademicYear, OrderItemImport, PrismaClient } from "@/generated/prisma/client";
import { AcademicYear as AcademicYearT } from "@/lib/eactivities";
import createLogger from "@/lib/logger";
import { PrismaPg } from "@prisma/adapter-pg";
import { parse } from "csv-parse";
// Load .env file
import dotenv from "dotenv";
import assert from "node:assert";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { join } from "node:path";
import * as XLSX from "xlsx";

const logger = createLogger("collection.import", "info");

dotenv.config();

const PRODUCTS_MAP_FILE = join(__dirname, "data/summer-2026/products_real.csv");
const DATA_ROOT_FILE = join(__dirname, "data/summer-2026/summer merch purchases");
const ACADEMIC_YEAR: AcademicYearT = "25-26";

/**
 * Convert the Members CSV into this for lookup
 */
interface Member {
    /** MUST be correct as it is used as the unique ID in the DB to link orders to a studnt */
    shortcode: string;
    /** Ideally make this right, but if not just use the shortcode */
    cid: string;
    firstName: string;
    lastName: string;
    email: string;
}
type CID = string;
type MembersMap = Map<CID, Member>;

// 0: init db
const prisma = new PrismaClient({
    // datasources: {
    //     db: {
    //         url: process.env.COLLECTION_DATABASE_URL, // used to specify production URL
    //     },
    // },
    adapter: new PrismaPg({ connectionString: process.env.COLLECTION_DATABASE_URL }),
});

/**
 * Lookup a member by CID & return a Member object.
 *
 * Algorithm proceeds as follows:
 * 1. Check if the CID exists in the members map.
 * 2. If it does, return the corresponding Member object.
 * 3. If it doesn't, lookup the CID in {@link prisma.ImperialStudent}
 * 4. If found, return a Member object constructed from the ImperialStudent data.
 * 5. If not found, return null.
 */
class MemberLookup {
    private membersMap: MembersMap = new Map();
    constructor(private membershipCSV: string) {}

    public async init(): Promise<void> {
        // Load the membership CSV and populate the membersMap
        // This is a placeholder for actual CSV parsing logic
        // In a real implementation, you would read the CSV file and populate the map accordingly

        const parser = createReadStream(this.membershipCSV).pipe(
            parse({
                cast: false, // CIDs get converted to numbers, bad
                columns: true,
                skip_empty_lines: true,
            }),
        );

        for await (const row of parser) {
            const member: Member = {
                shortcode: row["Login"],
                cid: row["CID"],
                firstName: row["First Name"],
                lastName: row["Surname"],
                email: row["Email"],
            };
            // Assert all fields present
            assert(
                member.shortcode &&
                    member.cid &&
                    member.firstName &&
                    member.lastName &&
                    member.email,
                `Missing fields in membership CSV row ${JSON.stringify(row)}`,
            );
            // If already in the map, assert that the data is consistent
            if (this.membersMap.has(member.cid)) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const existingMember = this.membersMap.get(member.cid)!;
                assert(
                    existingMember.shortcode === member.shortcode &&
                        existingMember.firstName === member.firstName &&
                        existingMember.lastName === member.lastName &&
                        existingMember.email === member.email,
                    `Inconsistent data for CID ${member.cid} in membership CSV`,
                );
            }
            this.membersMap.set(member.cid, member);
        }
    }

    public async lookup(cid: CID): Promise<Member | null> {
        // 1: Lookup member in map
        logger.debug(`Looking up member with CID ${cid} in members map...`);
        if (this.membersMap.has(cid)) {
            logger.debug(`Found member with CID ${cid} in members map`);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return this.membersMap.get(cid)!;
        }

        // 2: Use db
        const dbLookup = await prisma.imperialStudent.findUnique({
            where: { cid },
        });

        if (dbLookup) {
            logger.debug(`Found member with CID ${cid} in database`);
            return {
                shortcode: dbLookup.shortcode,
                cid: dbLookup.cid,
                firstName: dbLookup.firstName,
                lastName: dbLookup.lastName,
                email: dbLookup.email,
            };
        }

        logger.debug(`No member found with CID ${cid}`);
        return null;
    }
}

interface ProductLocal {
    productId: number;
    productName: string;
    variantName: string;
}
type ProductId = string;
type ProductLocalMap = Map<ProductId, ProductLocal>;

async function loadProductsMap(mapFile: string = PRODUCTS_MAP_FILE): Promise<ProductLocalMap> {
    logger.info("Loading products map...");
    const parser = createReadStream(mapFile).pipe(
        parse({
            cast: false,
            columns: true,
            skip_empty_lines: true,
        }),
    );

    const productsMap = new Map<string, ProductLocal>();
    for await (const row of parser) {
        const prodId = row["product_id"];
        const prodName = row["product"];
        const variantName = row["variant"];
        if (!prodId || !prodName || !variantName) {
            logger.warn(
                `Skipping row in products map due to missing fields. Row was ${JSON.stringify(
                    row,
                )}`,
            );
            continue;
        }
        productsMap.set(prodId, {
            productId: parseInt(prodId, 10),
            productName: prodName,
            variantName,
        });
    }

    return productsMap;
}

/** From Claude code - read XLSX */

type CellValue = string | number | boolean | Date | null | undefined;

interface SheetIteratorOptions {
    /** Sheet name to read; defaults to the first sheet in the workbook */
    sheetName?: string;
    /** If true, parse date cells as JS Date objects */
    cellDates?: boolean;
}

/**
 * Reads rows from a sheet, using the first row as object keys.
 * T should describe the expected shape of each row.
 */
function readSheetAsObjects<T extends Record<string, CellValue>>(
    filePath: string,
    options: SheetIteratorOptions = {},
): T[] {
    const workbook: XLSX.WorkBook = XLSX.readFile(filePath, {
        cellDates: options.cellDates ?? false,
    });

    const sheetName = options.sheetName ?? workbook.SheetNames[0];
    const worksheet: XLSX.WorkSheet | undefined = workbook.Sheets[sheetName];

    if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }

    // header: undefined (default) tells sheet_to_json to use row 1 as keys
    const rows = XLSX.utils.sheet_to_json<T>(worksheet, {
        defval: null,
        raw: true,
    });

    return rows;
}

interface ProductDataRaw {
    "Student ID": string;
    Name: string;
    "Date Purchased": string;
    "Member Type": string;
    [key: string]: CellValue; // Allow for additional properties]
}

/**
 * Import a XLSX file into the data
 */
async function importXLSX(
    filePath: string,
    productsMap: ProductLocalMap,
    studentLookup: MemberLookup,
    importItem: OrderItemImport,
    academicYear: AcademicYear,
): Promise<void> {
    logger.info(`Importing data from ${filePath}...`);

    // If does match format Product_Sales_ID_(4 digital number).xlsx, skip
    const fileName = filePath.split("/").slice(-1)[0];
    const match = fileName.match(/^Product_Sales_ID_(\d{4})\.xlsx$/);
    if (!match) {
        logger.warn(`Skipping file ${filePath} as it does not match expected format`);
        return;
    }

    const productId = match[1];
    if (!productsMap.has(productId)) {
        logger.warn(
            `Skipping file ${filePath} as product ID ${productId} not found in products map`,
        );
        return;
    }

    const productInfo = productsMap.get(productId)!;
    logger.info(`Importing orders for product ${productInfo.productName}...`);

    // 1: If product not exist, create it (with variant)
    logger.info(`Upserting product ${productInfo.productName}...`);
    const product = await prisma.rootItem.upsert({
        where: {
            name_academicYear: {
                name: productInfo.productName,
                academicYear: academicYear.year,
            },
        },
        update: {
            eActivitiesId: productInfo.productId,
        },
        create: {
            eActivitiesId: productInfo.productId,
            name: productInfo.productName,
            academicYear: academicYear.year,
        },
        include: {},
    });

    // 2: Upsert varient (lookup name)
    let varientLookup = await prisma.variant.findFirst({
        where: {
            variantName: productInfo.variantName,
            rootItemId: product.id,
        },
    });

    if (!varientLookup) {
        logger.info(
            `Creating variant ${productInfo.variantName} for product ${productInfo.productName}...`,
        );
        varientLookup = await prisma.variant.create({
            data: {
                variantName: productInfo.variantName,
                rootItemId: product.id,
            },
        });
    } else {
        logger.info(
            `Variant ${productInfo.variantName} already exists for product ${productInfo.productName}`,
        );
    }

    // Import the XLSX file and process each order, linking to the student via CID and the product/variant via the productsMap.
    const loadedXLSX = readSheetAsObjects<ProductDataRaw>(filePath, { cellDates: false });
    const recordCount = loadedXLSX.length;
    logger.info(`Loaded ${recordCount} records from ${filePath}`);

    // Group loadedXLSX by CID, to deal with quantities
    const cidToOrdersMap = new Map<string, ProductDataRaw[]>();
    for (const record of loadedXLSX) {
        const cid = record["Student ID"];
        if (!cid) {
            logger.warn(
                `Skipping order due to missing Student ID. Record was ${JSON.stringify(record)}`,
            );
            continue;
        }
        if (!cidToOrdersMap.has(cid)) {
            cidToOrdersMap.set(cid, []);
        }
        cidToOrdersMap.get(cid)?.push(record);
    }

    // Now process each CID group
    let overallIndex = 0;
    const ordersSize = cidToOrdersMap.size;
    for (const [cid, records] of cidToOrdersMap.entries()) {
        // Lookup student by CID
        const member = await studentLookup.lookup(cid);
        if (!member) {
            logger.warn(`No member found for CID ${cid}. Skipping order.`);
            continue;
        }

        logger.debug(`Upserting order...`);

        // OrderID in DB is an Int
        // But SUMS gives no order id
        // construct order id from product ID * 100 + index of order
        const orderId = parseInt(productId, 10) * 100000 + overallIndex;
        // Check not above 2^31-1
        if (orderId > 2147483647) {
            logger.error(
                `Constructed order ID ${orderId} exceeds maximum value for Int in database. Skipping order.`,
            );
            continue;
        }
        logger.debug(`Constructed order ID: ${orderId}`);

        logger.info(
            `(${overallIndex + 1}/${ordersSize}) Processing order of /${productInfo.productName}/${
                productInfo.variantName
            } for ${member.shortcode} (CID: ${cid}, orderID: ${orderId}) with ${
                records.length
            } items...`,
        );

        // Lookup student
        logger.debug(`Upserting student with shortcode ${member.shortcode}...`);
        const student = await prisma.imperialStudent.upsert({
            where: { shortcode: member.shortcode },
            update: {
                // Some CID are not valid, update them here
                cid: member.cid,
            },
            create: {
                shortcode: member.shortcode,
                cid: member.cid,
                firstName: member.firstName,
                lastName: member.lastName,
                email: member.email,
            },
        });

        // cast first Date Purchased to Date if it's a string
        const datePurchasedDate: Date = new Date(records[0]["Date Purchased"]);
        if (isNaN(datePurchasedDate.getTime())) {
            logger.warn(
                `Invalid date format for Date Purchased: ${records[0]["Date Purchased"]}. Skipping order.`,
            );
            continue;
        }

        logger.debug(`Upserted student with ID ${student.id}`);
        logger.debug(`Creating order for student ${student.shortcode}...`);
        await prisma.order.create({
            data: {
                studentId: student.id,
                orderDate: datePurchasedDate,
                academicYear: academicYear.year,
                orderNo: orderId,
                OrderItem: {
                    create: {
                        quantity: records.length,
                        variantId: varientLookup.id,
                        importId: importItem.id,
                    },
                },
            },
        });

        // Inc index
        overallIndex++;
    }
}

// Main
async function main() {
    logger.info("Starting import process...");

    // Load members map
    const memberLookup = new MemberLookup("data/summer-2026/Members_Report.csv");
    await memberLookup.init();

    // Load products map
    const productsMap = await loadProductsMap();

    // 1: Create an import
    logger.info("Creating import item...");
    const importKey = `Summer 2026 merch pre-orders import @ ${new Date().toLocaleString("en-GB")}`;
    const importItem = await prisma.orderItemImport.create({
        data: {
            name: importKey,
        },
    });
    logger.info(`Created import item with ID ${importItem.id} and name ${importItem.name}`);

    // Lookup academic year record
    const academicYearRecord = await prisma.academicYear.findUnique({
        where: { year: ACADEMIC_YEAR },
    });
    if (!academicYearRecord) {
        throw new Error(`Academic year ${ACADEMIC_YEAR} not found in database`);
    }
    logger.info(
        `Found academic year record for ${ACADEMIC_YEAR} with ID ${academicYearRecord.year}`,
    );

    // 2: List files in the data root and import them
    const files = await fs.readdir(DATA_ROOT_FILE);
    for (const file of files) {
        const filePath = join(DATA_ROOT_FILE, file);
        await importXLSX(filePath, productsMap, memberLookup, importItem, academicYearRecord);
    }

    logger.info("Import process complete");
}

main();
