import { forfeitWhere } from "../lib/forfeit";

const before = new Date("2026-06-01T00:00:00Z");

describe("forfeitWhere", () => {
    it("only includes uncollected items from orders placed before the cut-off", () => {
        expect(forfeitWhere({ before, productIds: [], variantIds: [] })).toEqual({
            state: "UNCOLLECTED",
            Order: { orderDate: { lt: before } },
        });
    });

    it("limits to the chosen products and variants when any are picked", () => {
        expect(forfeitWhere({ before, productIds: [1], variantIds: [7, 8] })).toEqual({
            state: "UNCOLLECTED",
            Order: { orderDate: { lt: before } },
            OR: [{ variantId: { in: [7, 8] } }, { Variant: { rootItemId: { in: [1] } } }],
        });
    });
});
