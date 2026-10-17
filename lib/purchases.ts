import type { OrderResponse } from "@/lib/crud/purchase";

/** A single purchased item, flattened with the details of the order it came from */
export interface OrderUI {
    id: number;
    orderNo: number;
    date: Date;
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
