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
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
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

interface ForfeitValues {
    /** YYYY-MM-DD, as a date input gives it */
    before: string;
    scope: "all" | "some";
    /** "p:<id>" for every variant of a product, "v:<id>" for a single variant */
    selected: string[];
}

/** What happened after the last Check or Forfeit */
type Outcome =
    | { kind: "preview"; preview: ForfeitPreview }
    | { kind: "error"; message: string }
    | { kind: "done"; message: string }
    | null;

const buildScope = ({ before, scope, selected }: ForfeitValues): ForfeitScope => {
    const ids = (prefix: string) =>
        scope === "all"
            ? []
            : selected
                  .filter((value) => value.startsWith(prefix))
                  .map((value) => Number(value.slice(prefix.length)));
    return { before: startOfDay(before), productIds: ids("p:"), variantIds: ids("v:") };
};

export const ForfeitForm = ({
    productsByYear,
}: {
    productsByYear: ProductsAndVariantsByAcademicYear[];
}) => {
    const [outcome, setOutcome] = useState<Outcome>(null);
    const [confirmOpen, confirm] = useDisclosure(false);
    const [isChecking, startChecking] = useTransition();

    const form = useForm<ForfeitValues>({
        initialValues: { before: "", scope: "all", selected: [] },
        validate: {
            // YYYY-MM-DD strings compare in date order
            before: (value) =>
                !value
                    ? "Choose a date"
                    : value > today()
                      ? "The date can't be in the future"
                      : null,
            selected: (value, values) =>
                values.scope === "some" && value.length === 0
                    ? "Pick at least one product or variant"
                    : null,
        },
        // Any change means the preview no longer matches what would be forfeited, so it must be checked again
        onValuesChange: () => setOutcome(null),
    });
    const { before, scope, selected } = form.getValues();
    const preview = outcome?.kind === "preview" ? outcome.preview : null;

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

    const check = (values: ForfeitValues) =>
        startChecking(async () => {
            setOutcome(null);
            const res = await previewForfeit(buildScope(values));
            setOutcome(
                res.status === "error"
                    ? { kind: "error", message: res.error }
                    : { kind: "preview", preview: res.preview },
            );
        });

    const forfeit = async () => {
        if (!preview) return;
        const res = await forfeitItems(buildScope(form.getValues()), preview.items);
        setOutcome(
            res.status === "error"
                ? { kind: "error", message: res.error }
                : { kind: "done", message: `Forfeited ${plural(res.forfeited, "item")}.` },
        );
    };

    return (
        <Stack gap="lg">
            <Paper withBorder radius="md" p="md" component="form" onSubmit={form.onSubmit(check)}>
                <Stack gap="md">
                    <TextInput
                        type="date"
                        label="Orders placed before"
                        description="Orders placed on this date are not included"
                        max={today()}
                        key={form.key("before")}
                        {...form.getInputProps("before")}
                        maw={260}
                    />

                    <Stack gap={6}>
                        <Text size="sm" fw={500}>
                            Items
                        </Text>
                        <SegmentedControl
                            key={form.key("scope")}
                            {...form.getInputProps("scope")}
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
                            key={form.key("selected")}
                            {...form.getInputProps("selected")}
                            searchable
                            clearable
                            nothingFoundMessage="No matching products"
                        />
                    )}

                    <Group>
                        <Button type="submit" loading={isChecking}>
                            Check what will be forfeited
                        </Button>
                    </Group>
                </Stack>
            </Paper>

            {outcome?.kind === "error" && (
                <Alert color="red" icon={<FaTimesCircle />}>
                    {outcome.message}
                </Alert>
            )}

            {outcome?.kind === "done" && (
                <Alert color="green" icon={<FaCheckCircle />}>
                    {outcome.message}
                </Alert>
            )}

            {preview &&
                (preview.items === 0 ? (
                    <Alert color="blue">
                        Nothing to forfeit: no uncollected items match from orders placed before{" "}
                        {formatLongDate(before)}.
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
                                {formatLongDate(before)}.
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
                                <Button color="red" onClick={confirm.open}>
                                    Forfeit {plural(preview.items, "item")}
                                </Button>
                            </Group>
                        </Stack>
                    </Paper>
                ))}

            <ConfirmModal
                opened={confirmOpen}
                close={confirm.close}
                confirmButtonText={`Yes, forfeit ${plural(preview?.items ?? 0, "item")}`}
                onConfirm={forfeit}
            >
                <Text>
                    Forfeit <b>{plural(preview?.items ?? 0, "uncollected item")}</b> from orders
                    placed before <b>{before && formatLongDate(before)}</b>? They won&apos;t be
                    handed out. There is no bulk undo: each item would have to be changed back on
                    the student&apos;s page.
                </Text>
            </ConfirmModal>
        </Stack>
    );
};
