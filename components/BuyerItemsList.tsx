"use client";

/**
 * Phone-friendly view of a buyer's items: a progress summary, then one card per item split into
 * what is still to collect and what has been collected. Tablet and desktop use the table instead.
 */
import { markCollection, type OrderResponse } from "@/lib/crud/purchase";
import { flattenPurchases, splitByCollected, type OrderUI } from "@/lib/purchases";
import { formatDateDDMMYYYY } from "@/lib/util";
import {
    ActionIcon,
    Alert,
    Badge,
    Box,
    Button,
    Group,
    Loader,
    Paper,
    Skeleton,
    Stack,
    Text,
} from "@mantine/core";
import React, { useOptimistic, useState, useTransition } from "react";
import { FaCheck, FaTimesCircle } from "react-icons/fa";

import styles from "./BuyerItemsList.module.scss";

const SectionHeading = ({ title, count }: { title: string; count: number }) => (
    <Group gap="xs">
        <Text fw={700} size="xs" tt="uppercase" c="dimmed" lts={0.5}>
            {title}
        </Text>
        <Badge size="sm" circle variant="light" color="gray">
            {count}
        </Badge>
    </Group>
);

const ItemCard = ({ row, onToggle }: { row: OrderUI; onToggle: (collected: boolean) => void }) => {
    const label = `${row.item}, ${row.variant}`;

    return (
        <Paper
            withBorder
            radius="md"
            p="sm"
            className={styles.card}
            data-collected={row.collected || undefined}
        >
            <Group wrap="nowrap" gap="sm">
                <Stack gap={2} flex={1} miw={0}>
                    <Group gap={6} wrap="nowrap" align="flex-start">
                        <Text fw={700} lh={1.25}>
                            {row.item}
                        </Text>
                        {row.quantity > 1 && (
                            <Badge
                                color="orange"
                                variant="filled"
                                aria-label={`Quantity ${row.quantity}`}
                            >
                                ×{row.quantity}
                            </Badge>
                        )}
                    </Group>
                    <Text size="sm" fw={500}>
                        {row.variant}
                    </Text>
                    <Text size="xs" c="dimmed">
                        Order #{row.orderNo} · {formatDateDDMMYYYY(new Date(row.date))}
                    </Text>
                </Stack>

                {row.collected ? (
                    <ActionIcon
                        size={44}
                        radius="xl"
                        variant="default"
                        c="green"
                        aria-label={`${label} is collected. Tap to mark as not collected`}
                        onClick={() => onToggle(false)}
                    >
                        <FaCheck size={18} />
                    </ActionIcon>
                ) : (
                    <Button
                        size="md"
                        h={44}
                        color="green"
                        aria-label={`Mark ${label} as collected`}
                        onClick={() => onToggle(true)}
                    >
                        Collect
                    </Button>
                )}
            </Group>
        </Paper>
    );
};

export const BuyerItemsList = ({
    purchases,
    shortcode,
    refresh,
    isLoading,
}: {
    purchases: OrderResponse[];
    shortcode: string;
    refresh: () => Promise<void>;
    isLoading: boolean;
}) => {
    const [isSaving, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Show a change straight away; it settles to the real value once saved (or reverts if it fails)
    const [rows, setCollectedOptimistically] = useOptimistic(
        flattenPurchases(purchases),
        (current, update: { itemID: number; collected: boolean }) =>
            current.map((row) =>
                row.itemID === update.itemID ? { ...row, collected: update.collected } : row,
            ),
    );

    const toggle = (row: OrderUI, collected: boolean) => {
        // Ignore taps while saving: the list reorders, so a quick second tap would hit another item
        if (isSaving) return;
        setError(null);
        startTransition(async () => {
            setCollectedOptimistically({ itemID: row.itemID, collected });
            try {
                await markCollection(row.orderNo, row.itemID, collected, shortcode);
                await refresh();
            } catch (e) {
                console.error(e);
                setError(`Couldn't save ${row.item} (${row.variant}). Please try again.`);
            }
        });
    };

    if (!shortcode) return null;

    if (rows.length === 0) {
        return isLoading ? (
            <Stack gap="sm">
                <Skeleton h={72} radius="md" />
                <Skeleton h={72} radius="md" />
                <Skeleton h={72} radius="md" />
            </Stack>
        ) : (
            <Paper withBorder radius="md" p="lg">
                <Text ta="center" c="dimmed">
                    No purchases found for the selected academic years
                </Text>
            </Paper>
        );
    }

    const { toCollect, collected } = splitByCollected(rows);
    const allDone = toCollect.length === 0;

    return (
        <Stack gap="md">
            <Paper withBorder radius="md" p="md">
                <Group justify="space-between" mb="sm" wrap="nowrap">
                    <Group gap="xs">
                        <Text fw={700}>
                            {collected.length} of {rows.length} collected
                        </Text>
                        {isSaving && <Loader size="xs" />}
                    </Group>
                    {allDone ? (
                        <Badge color="green" leftSection={<FaCheck size={10} />}>
                            All done
                        </Badge>
                    ) : (
                        <Badge color="orange" variant="light">
                            {toCollect.length} to go
                        </Badge>
                    )}
                </Group>
                <Group gap={4} wrap="nowrap" aria-hidden>
                    {[...collected, ...toCollect].map((row) => (
                        <Box
                            key={row.itemID}
                            flex={1}
                            className={styles.segment}
                            data-collected={row.collected || undefined}
                        />
                    ))}
                </Group>
            </Paper>

            {error && (
                <Alert color="red" icon={<FaTimesCircle />}>
                    {error}
                </Alert>
            )}

            {toCollect.length > 0 && (
                <Stack gap="xs">
                    <SectionHeading title="To collect" count={toCollect.length} />
                    {toCollect.map((row) => (
                        <ItemCard key={row.itemID} row={row} onToggle={(c) => toggle(row, c)} />
                    ))}
                </Stack>
            )}

            {collected.length > 0 && (
                <Stack gap="xs">
                    <SectionHeading title="Collected" count={collected.length} />
                    {collected.map((row) => (
                        <ItemCard key={row.itemID} row={row} onToggle={(c) => toggle(row, c)} />
                    ))}
                </Stack>
            )}
        </Stack>
    );
};
