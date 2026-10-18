import type { OrderResponse } from "../lib/crud/purchase";
import { collectionProgress, flattenPurchases, groupByYear, splitByState } from "../lib/purchases";

const orders: OrderResponse[] = [
    {
        orderIDInternal: 1,
        orderNoShop: 6001,
        date: new Date("2026-10-14"),
        academicYear: "26-27",
        items: [
            { id: 10, name: "Hoodie", variant: "L - Navy", state: "UNCOLLECTED", quantity: 1 },
            { id: 11, name: "Lanyard", variant: "Standard", state: "COLLECTED", quantity: 2 },
        ],
    },
    {
        orderIDInternal: 2,
        orderNoShop: 6002,
        date: new Date("2026-10-16"),
        academicYear: "26-27",
        items: [
            { id: 12, name: "Tote Bag", variant: "One size", state: "UNCOLLECTED", quantity: 1 },
            { id: 13, name: "Scarf", variant: "Standard", state: "FORFEITED", quantity: 1 },
            { id: 14, name: "Mug", variant: "Standard", state: "REFUNDED", quantity: 1 },
        ],
    },
];

describe("flattenPurchases", () => {
    it("gives one row per item, carrying the order number and date of its order", () => {
        const rows = flattenPurchases(orders);

        expect(rows.map((row) => [row.itemID, row.item, row.orderNo])).toEqual([
            [10, "Hoodie", 6001],
            [11, "Lanyard", 6001],
            [12, "Tote Bag", 6002],
            [13, "Scarf", 6002],
            [14, "Mug", 6002],
        ]);
        expect(rows[2].date).toEqual(new Date("2026-10-16"));
    });

    it("sorts by order then item, so the order does not change when the database returns rows differently", () => {
        const shuffled = [
            { ...orders[1] },
            { ...orders[0], items: [orders[0].items[1], orders[0].items[0]] },
        ];

        expect(flattenPurchases(shuffled).map((row) => row.itemID)).toEqual([10, 11, 12, 13, 14]);
    });

    it("returns nothing for a buyer with no orders", () => {
        expect(flattenPurchases([])).toEqual([]);
    });
});

describe("splitByState", () => {
    it("puts each item under its state, keeping the original order", () => {
        const byState = splitByState(flattenPurchases(orders));

        expect(byState.UNCOLLECTED.map((row) => row.itemID)).toEqual([10, 12]);
        expect(byState.COLLECTED.map((row) => row.itemID)).toEqual([11]);
        expect(byState.FORFEITED.map((row) => row.itemID)).toEqual([13]);
        expect(byState.REFUNDED.map((row) => row.itemID)).toEqual([14]);
    });
});

describe("collectionProgress", () => {
    it("leaves forfeited and refunded items out of what is expected to be collected", () => {
        expect(collectionProgress(flattenPurchases(orders))).toEqual({
            toCollect: 2,
            collected: 1,
            expected: 3,
        });
    });
});

describe("groupByYear", () => {
    const lastYear: OrderResponse = {
        orderIDInternal: 3,
        orderNoShop: 5001,
        date: new Date("2025-10-01"),
        academicYear: "25-26",
        items: [{ id: 9, name: "Hoodie", variant: "M - Black", state: "COLLECTED", quantity: 1 }],
    };

    it("groups items by academic year, newest year first", () => {
        const groups = groupByYear(flattenPurchases([lastYear, ...orders]));

        expect(groups.map((group) => group.year)).toEqual(["26-27", "25-26"]);
        expect(groups[0].items.map((row) => row.itemID)).toEqual([10, 11, 12, 13, 14]);
        expect(groups[1].items.map((row) => row.itemID)).toEqual([9]);
    });

    it("gives a single group for a buyer with one year", () => {
        expect(groupByYear(flattenPurchases(orders)).map((group) => group.year)).toEqual(["26-27"]);
    });
});
