"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { forfeitItems, previewForfeit, type ForfeitPreview } from "@/lib/crud/forfeit";
import type { ProductsAndVariantsByAcademicYear } from "@/lib/crud/products";
import type { ForfeitScope } from "@/lib/forfeit";
import {
    Alert,
    Button,
    Divider,
    Group,
    MultiSelect,
    Paper,
    SegmentedControl,
    Stack,
    Text,
    TextInput,
} from "@mantine/core";
import React, { useState, useTransition } from "react";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";

/** Today as YYYY-MM-DD in the user's time zone, the format a date input uses */
const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** Start of the given YYYY-MM-DD day in the user's time zone */
const startOfDay = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day);
};

const formatLongDate = (date: string) =>
    startOfDay(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const ForfeitForm = ({
    productsByYear,
}: {
    productsByYear: ProductsAndVariantsByAcademicYear[];
}) => {
    const [date, setDate] = useState("");
    const [scope, setScope] = useState<"all" | "some">("all");
    // "p:<id>" for every variant of a product, "v:<id>" for a single variant
    const [selected, setSelected] = useState<string[]>([]);

    const [preview, setPreview] = useState<ForfeitPreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isChecking, startChecking] = useTransition();

    // Any change means the preview no longer matches what would be forfeited, so it must be checked again
    const changed = () => {
        setPreview(null);
        setError(null);
        setDone(null);
    };

    const options = productsByYear.flatMap(({ year, RootItem }) =>
        RootItem.map((product) => ({
            group: `${product.name} (${year})`,
            items: [
                { value: `p:${product.id}`, label: `${product.name}: all variants` },
                ...product.Variant.map((variant) => ({
                    value: `v:${variant.id}`,
                    label: `${product.name}: ${variant.variantName}`,
                })),
            ],
        })),
    );

    const buildScope = (): ForfeitScope => {
        const ids = (prefix: string) =>
            scope === "all"
                ? []
                : selected
                      .filter((value) => value.startsWith(prefix))
                      .map((value) => Number(value.slice(prefix.length)));
        return { before: startOfDay(date), productIds: ids("p:"), variantIds: ids("v:") };
    };

    const canCheck = date !== "" && (scope === "all" || selected.length > 0);

    const check = () =>
        startChecking(async () => {
            changed();
            const res = await previewForfeit(buildScope());
            if (res.status === "error") {
                setError(res.error);
            } else {
                setPreview(res.preview);
            }
        });

    const forfeit = async () => {
        if (!preview) return;
        const res = await forfeitItems(buildScope(), preview.items);
        setPreview(null);
        if (res.status === "error") {
            setError(res.error);
        } else {
            setDone(`Forfeited ${plural(res.forfeited, "item")}.`);
        }
    };

    return (
        <Stack gap="lg">
            <Paper withBorder radius="md" p="md">
                <Stack gap="md">
                    <TextInput
                        type="date"
                        label="Orders placed before"
                        description="Orders placed on this date are not included"
                        max={today()}
                        value={date}
                        onChange={(e) => {
                            setDate(e.currentTarget.value);
                            changed();
                        }}
                        maw={260}
                    />

                    <Stack gap={6}>
                        <Text size="sm" fw={500}>
                            Items
                        </Text>
                        <SegmentedControl
                            value={scope}
                            onChange={(value) => {
                                setScope(value as "all" | "some");
                                changed();
                            }}
                            data={[
                                { value: "all", label: "All items" },
                                { value: "some", label: "Only some items" },
                            ]}
                            maw={360}
                        />
                    </Stack>

                    {scope === "some" && (
                        <MultiSelect
                            label="Products and variants"
                            description="Pick a whole product, or just some of its variants"
                            placeholder={selected.length === 0 ? "Search products" : undefined}
                            data={options}
                            value={selected}
                            onChange={(value) => {
                                setSelected(value);
                                changed();
                            }}
                            searchable
                            clearable
                            nothingFoundMessage="No matching products"
                        />
                    )}

                    <Group>
                        <Button onClick={check} disabled={!canCheck} loading={isChecking}>
                            Check what will be forfeited
                        </Button>
                    </Group>
                </Stack>
            </Paper>

            {error && (
                <Alert color="red" icon={<FaTimesCircle />}>
                    {error}
                </Alert>
            )}

            {done && (
                <Alert color="green" icon={<FaCheckCircle />}>
                    {done}
                </Alert>
            )}

            {preview &&
                (preview.items === 0 ? (
                    <Alert color="blue">
                        Nothing to forfeit: no uncollected items match from orders placed before{" "}
                        {formatLongDate(date)}.
                    </Alert>
                ) : (
                    <Paper withBorder radius="md" p="md" aria-label="What will be forfeited">
                        <Stack gap="sm">
                            <Text fw={700} size="lg">
                                {plural(preview.items, "uncollected item")} will be forfeited
                            </Text>
                            <Text size="sm" c="dimmed">
                                From {plural(preview.orders, "order")} by{" "}
                                {plural(preview.students, "student")}, placed before{" "}
                                {formatLongDate(date)}.
                            </Text>
                            <Divider />
                            <Stack gap={4}>
                                {preview.byVariant.map((row) => (
                                    <Group
                                        key={`${row.product}\n${row.variant}`}
                                        justify="space-between"
                                        wrap="nowrap"
                                    >
                                        <Text size="sm">
                                            <b>{row.product}</b> · {row.variant}
                                        </Text>
                                        <Text size="sm" fw={700} flex="none">
                                            {row.items}
                                        </Text>
                                    </Group>
                                ))}
                            </Stack>
                            <Group justify="flex-end">
                                <Button color="red" onClick={() => setConfirmOpen(true)}>
                                    Forfeit {plural(preview.items, "item")}
                                </Button>
                            </Group>
                        </Stack>
                    </Paper>
                ))}

            <ConfirmModal
                opened={confirmOpen}
                close={() => setConfirmOpen(false)}
                confirmButtonText={`Yes, forfeit ${plural(preview?.items ?? 0, "item")}`}
                onConfirm={forfeit}
            >
                <Text>
                    Forfeit <b>{plural(preview?.items ?? 0, "uncollected item")}</b> from orders
                    placed before <b>{date && formatLongDate(date)}</b>? They won&apos;t be handed
                    out. There is no bulk undo: each item would have to be changed back on the
                    student&apos;s page.
                </Text>
            </ConfirmModal>
        </Stack>
    );
};
