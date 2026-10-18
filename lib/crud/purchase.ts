"use server";

import { auth } from "@/auth";
import { CollectionState } from "@/generated/prisma/enums";
import { revalidateTag } from "next/cache";

import prisma from "../db";

export interface OrderResponse {
    orderIDInternal: number;
    orderNoShop: number;
    date: Date;
    /** Academic year the order belongs to, e.g. "26-27" */
    academicYear: string;

    items: {
        id: number;
        name: string;
        variant: string;
        state: CollectionState;
        quantity: number;
    }[];
}

export type GetPurchasesReturn =
    | {
          status: "success";
          orders: OrderResponse[];
      }
    | { status: "error"; message: string };
export const getPurchasesByShortcode = async (
    shortcode: string,
    academicYears: string[],
): Promise<GetPurchasesReturn> => {
    const student = await prisma.imperialStudent.findFirst({
        where: {
            shortcode: shortcode,
        },
        include: {
            Order: {
                include: {
                    OrderItem: {
                        include: {
                            Variant: {
                                include: {
                                    RootItem: true,
                                },
                            },
                        },
                    },
                },
                where: {
                    academicYear: {
                        in: academicYears,
                    },
                },
            },
        },
    });

    if (!student) {
        return {
            status: "error",
            message: "Student not found",
        };
    }

    // Map to interface
    const flatOrderedItems: OrderResponse[] = student.Order.flatMap((order) => {
        return {
            orderIDInternal: order.id,
            orderNoShop: order.orderNo,
            date: order.orderDate,
            academicYear: order.academicYear,
            items: order.OrderItem.map((orderItem) => {
                return {
                    name: orderItem.Variant.RootItem.name,
                    variant: orderItem.Variant.variantName,
                    state: orderItem.state,
                    id: orderItem.id,
                    quantity: orderItem.quantity,
                };
            }),
        };
    });

    return {
        status: "success",
        orders: flatOrderedItems,
    };
};

/** The states an item can be given from a student's page. FORFEITED is only set in bulk (see `forfeit.ts`) */
const INDIVIDUAL_STATES: CollectionState[] = ["UNCOLLECTED", "COLLECTED", "REFUNDED"];

export const setItemState = async (
    orderNo: number,
    itemID: number,
    state: CollectionState,
    shortcode: string,
) => {
    // Action so auth needed
    const session = await auth();

    if (!session) {
        throw new Error("Unauthorized");
    }

    if (!INDIVIDUAL_STATES.includes(state)) {
        throw new Error(`An item can't be marked as ${state} on its own`);
    }

    await prisma.orderItem.update({
        where: {
            id: itemID,
            Order: {
                orderNo: orderNo,
            },
        },
        data: {
            state,
        },
    });

    revalidateTag(`purchases:${shortcode}`, { expire: 0 });
};
