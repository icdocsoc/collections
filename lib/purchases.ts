import type { CollectionState } from "@/generated/prisma/enums";
import type { OrderResponse } from "@/lib/crud/purchase";

/** A single purchased item, flattened with the details of the order it came from */
export interface OrderUI {
    id: number;
    orderNo: number;
    date: Date;
    academicYear: string;
    item: string;
    variant: string;
    state: CollectionState;
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
                state: item.state,
                itemID: item.id,
                quantity: item.quantity,
            })),
        )
        .sort((a, b) => a.orderNo - b.orderNo || a.itemID - b.itemID);

/** Split items by state, keeping their order */
export const splitByState = (items: OrderUI[]): Record<CollectionState, OrderUI[]> => ({
    UNCOLLECTED: items.filter((item) => item.state === "UNCOLLECTED"),
    COLLECTED: items.filter((item) => item.state === "COLLECTED"),
    FORFEITED: items.filter((item) => item.state === "FORFEITED"),
    REFUNDED: items.filter((item) => item.state === "REFUNDED"),
});

/**
 * Collection progress for a set of items. Forfeited and refunded items will never be handed out,
 * so they don't count towards what is expected to be collected.
 */
export const collectionProgress = (items: OrderUI[]) => {
    const toCollect = items.filter((item) => item.state === "UNCOLLECTED").length;
    const collected = items.filter((item) => item.state === "COLLECTED").length;
    return { toCollect, collected, expected: toCollect + collected };
};

/** Group items by academic year, newest year first (years look like "26-27", so they sort as text) */
export const groupByYear = (items: OrderUI[]): { year: string; items: OrderUI[] }[] =>
    [...new Set(items.map((item) => item.academicYear))]
        .sort()
        .reverse()
        .map((year) => ({ year, items: items.filter((item) => item.academicYear === year) }));
