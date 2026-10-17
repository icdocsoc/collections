import type { OrderResponse } from "@/lib/crud/purchase";

/** A single purchased item, flattened with the details of the order it came from */
export interface OrderUI {
    id: number;
    orderNo: number;
    date: Date;
    academicYear: string;
    item: string;
    variant: string;
    collected: boolean;
    itemID: number;
    quantity: number;
}

/**
 * Flatten a buyer's orders (each with several items) into one row per item.
 *
 * Rows are sorted by order, then item: the API returns them in whatever order the database
 * does, and that changes whenever a row is updated, which would shuffle the list after a tap.
 */
export const flattenPurchases = (purchases: OrderResponse[]): OrderUI[] =>
    purchases
        .flatMap((order) =>
            order.items.map((item) => ({
                id: item.id,
                orderNo: order.orderNoShop,
                date: order.date,
                academicYear: order.academicYear,
                item: item.name,
                variant: item.variant,
                collected: item.collected,
                itemID: item.id,
                quantity: item.quantity,
            })),
        )
        .sort((a, b) => a.orderNo - b.orderNo || a.itemID - b.itemID);

/** Split items into what is still to collect and what has been collected, keeping their order */
export const splitByCollected = (items: OrderUI[]) => ({
    toCollect: items.filter((item) => !item.collected),
    collected: items.filter((item) => item.collected),
});

/** Group items by academic year, newest year first (years look like "26-27", so they sort as text) */
export const groupByYear = (items: OrderUI[]): { year: string; items: OrderUI[] }[] =>
    [...new Set(items.map((item) => item.academicYear))]
        .sort()
        .reverse()
        .map((year) => ({ year, items: items.filter((item) => item.academicYear === year) }));
