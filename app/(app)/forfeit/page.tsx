import { auth } from "@/auth";
import { getProductsAndVariantByAcademicYearWithCounts } from "@/lib/crud/products";
import { Stack, Text, Title } from "@mantine/core";
import { redirect } from "next/navigation";
import React from "react";

import { ForfeitForm } from "./ForfeitForm";

const ForfeitPage = async () => {
    const session = await auth();

    if (!session) redirect("/auth/login");

    const productsByYear = await getProductsAndVariantByAcademicYearWithCounts();

    return (
        <Stack gap="lg" maw={720} mx="auto">
            <Stack gap="xs">
                <Title order={1} fz={{ base: "h3", sm: "h1" }}>
                    Forfeit uncollected items
                </Title>
                <Text>
                    Mark items that still haven&apos;t been collected from orders placed before a
                    date as <b>forfeited</b>, so they are no longer handed out. Items that have been
                    collected or refunded are never changed. A forfeited item can still be changed
                    on the student&apos;s page.
                </Text>
            </Stack>
            <ForfeitForm
                // Newest year first, as that is most likely what is being forfeited
                productsByYear={[...productsByYear].sort((a, b) => b.year.localeCompare(a.year))}
            />
        </Stack>
    );
};

export default ForfeitPage;
export const dynamic = "force-dynamic";
