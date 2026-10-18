"use server";

import { auth } from "@/auth";
import { forfeitWhere, type ForfeitScope } from "@/lib/forfeit";
import { revalidatePath } from "next/cache";

import prisma from "../db";

export interface ForfeitPreview {
    items: number;
    orders: number;
    students: number;
    /** How many items of each product/variant would be forfeited, largest first */
    byVariant: { product: string; variant: string; items: number }[];
}

const checkScope = (scope: ForfeitScope) => {
    if (Number.isNaN(scope.before.getTime())) {
        return "Please choose a valid date";
    }
    if (scope.before.getTime() > Date.now()) {
        return "The date can't be in the future";
    }
};

/** What `forfeitItems` would change, so it can be checked before anything is changed */
export async function previewForfeit(
    scope: ForfeitScope,
): Promise<{ status: "success"; preview: ForfeitPreview } | { status: "error"; error: string }> {
    // Action so auth needed
    const session = await auth();

    if (!session) {
        return { status: "error", error: "Unauthorized" };
    }

    const invalid = checkScope(scope);
    if (invalid) {
        return { status: "error", error: invalid };
    }

    const items = await prisma.orderItem.findMany({
        where: forfeitWhere(scope),
        select: {
            orderId: true,
            Order: { select: { studentId: true } },
            Variant: { select: { variantName: true, RootItem: { select: { name: true } } } },
        },
    });

    const byVariant = new Map<string, ForfeitPreview["byVariant"][number]>();
    for (const { Variant } of items) {
        const key = `${Variant.RootItem.name}\n${Variant.variantName}`;
        const entry = byVariant.get(key) ?? {
            product: Variant.RootItem.name,
            variant: Variant.variantName,
            items: 0,
        };
        entry.items++;
        byVariant.set(key, entry);
    }

    return {
        status: "success",
        preview: {
            items: items.length,
            orders: new Set(items.map((item) => item.orderId)).size,
            students: new Set(items.map((item) => item.Order.studentId)).size,
            byVariant: [...byVariant.values()].sort((a, b) => b.items - a.items),
        },
    };
}

/**
 * Mark every uncollected item in scope as forfeited.
 *
 * `expectedItems` is the count from the preview the user confirmed: if it no longer matches (e.g.
 * someone collected an item in the meantime) nothing is changed, so what is forfeited is always
 * exactly what was shown.
 */
export async function forfeitItems(
    scope: ForfeitScope,
    expectedItems: number,
): Promise<{ status: "success"; forfeited: number } | { status: "error"; error: string }> {
    // Action so auth needed
    const session = await auth();

    if (!session) {
        return { status: "error", error: "Unauthorized" };
    }

    const invalid = checkScope(scope);
    if (invalid) {
        return { status: "error", error: invalid };
    }

    try {
        const forfeited = await prisma.$transaction(async (tx) => {
            const { count } = await tx.orderItem.updateMany({
                where: forfeitWhere(scope),
                data: { state: "FORFEITED" },
            });
            if (count !== expectedItems) {
                // Throwing rolls the transaction back
                throw new Error(
                    `The number of items changed since you checked (${expectedItems} then, ${count} now). Nothing was forfeited: please check again.`,
                );
            }
            return count;
        });

        revalidatePath("/");
        return { status: "success", forfeited };
    } catch (e: any) {
        return { status: "error", error: e.message ?? e.toString() };
    }
}
