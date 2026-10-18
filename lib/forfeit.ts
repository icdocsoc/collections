import type { Prisma } from "@/generated/prisma/client";

/** Which items a bulk forfeit applies to */
export interface ForfeitScope {
    /** Only orders placed before this moment (start of the chosen day, in the user's time zone) */
    before: Date;
    /** Every variant of these products. Leave this and `variantIds` empty to include every item */
    productIds: number[];
    /** These variants */
    variantIds: number[];
}

/**
 * The items a bulk forfeit changes: only ones still waiting to be collected (collected and refunded
 * items are never touched) from orders placed before the cut-off, limited to the chosen
 * products/variants if any were picked.
 */
export const forfeitWhere = ({
    before,
    productIds,
    variantIds,
}: ForfeitScope): Prisma.OrderItemWhereInput => ({
    state: "UNCOLLECTED",
    Order: { orderDate: { lt: before } },
    ...(productIds.length > 0 || variantIds.length > 0
        ? {
              OR: [
                  { variantId: { in: variantIds } },
                  { Variant: { rootItemId: { in: productIds } } },
              ],
          }
        : {}),
});
