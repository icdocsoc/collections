import { ImportItemList } from "@/lib/crud/importCsv";
import { fetcher } from "@/lib/fetcher";
import { Stack, Center, Loader } from "@mantine/core";
import { createColumnHelper } from "@/components/tables/tableFeatures";
import React from "react";
import useSWR from "swr";

import TanstackTable from "./TanStackTable";

const columnHelper = createColumnHelper<ImportItemList["OrderItem"][number]>();

const columns = [
    columnHelper.accessor("Order.orderNo", {
        cell: (info) => info.getValue(),
        header: "Order No",
        id: "orderNo",
        sortFn: "alphanumeric",
    }),
    // columnHelper.accessor("Order.academicYear", {
    //     cell: (info) => info.getValue(),
    //     header: "Academic Year",
    //     id: "academicYear",
    //     sortFn: "alphanumeric",
    // }),
    // Shortcode
    columnHelper.accessor("Order.ImperialStudent.shortcode", {
        cell: (info) => info.getValue(),
        header: "Shortcode",
        id: "shortcode",
        sortFn: "alphanumeric",
    }),
    // Item name
    columnHelper.accessor("Variant.RootItem.name", {
        cell: (info) => info.getValue(),
        header: "Item Name",
        id: "itemName",
        sortFn: "alphanumeric",
    }),
    // Variant name
    columnHelper.accessor("Variant.variantName", {
        cell: (info) => info.getValue(),
        header: "Variant",
        id: "variant",
        sortFn: "alphanumeric",
    }),
    // Quantity
    columnHelper.accessor("quantity", {
        cell: (info) => info.getValue(),
        header: "Quantity",
        id: "quantity",
        sortFn: "alphanumeric",
    }),
];

export const ImportTable = ({ importId }: { importId: string }) => {
    const { data } = useSWR(`/api/imports/${importId}`, fetcher) satisfies { data: ImportItemList };

    if (!data)
        return (
            <Stack gap="md">
                <Center>
                    <Loader size={24} />
                </Center>
            </Stack>
        );
    return (
        <TanstackTable
            columns={columns}
            data={data.OrderItem}
            enableSearch={false}
            initialSort={[
                {
                    id: "orderNo",
                    desc: false,
                },
            ]}
        />
    );
};
