"use client";

/**
 * A buyer's items: a progress summary, then one card per item split into what is still to collect
 * and what has been collected (grouped by academic year when there is more than one). The same
 * view at every screen size, as a single column.
 */
import { ConfirmModal } from "@/components/ConfirmModal";
import { markCollection, type OrderResponse } from "@/lib/crud/purchase";
import { flattenPurchases, groupByYear, splitByCollected, type OrderUI } from "@/lib/purchases";
import { formatDateDDMMYYYY } from "@/lib/util";
import {
    Affix,
    Alert,
    Badge,
    Box,
    Button,
    Collapse,
    Group,
    Loader,
    Paper,
    Skeleton,
    Stack,
    Text,
    ThemeIcon,
    Title,
    UnstyledButton,
} from "@mantine/core";
import React, { useEffect, useOptimistic, useState, useTransition } from "react";
import { FaCheck, FaChevronDown, FaTimesCircle, FaUndo } from "react-icons/fa";

import styles from "./BuyerItemsList.module.scss";

/** Above this many items in total the Collected group starts folded away, so what is left stays on screen */
const COLLAPSE_COLLECTED_ABOVE = 8;

/** How long the "Undo" bar stays after collecting an item (ms) */
const UNDO_BAR_MS = 6000;

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

const CollectedToggle = ({
    count,
    expanded,
    onToggle,
}: {
    count: number;
    expanded: boolean;
    onToggle: () => void;
}) => (
    <UnstyledButton onClick={onToggle} aria-expanded={expanded} py={4}>
        <Group gap="xs">
            <Text fw={700} size="xs" tt="uppercase" c="dimmed" lts={0.5}>
                Collected
            </Text>
            <Badge size="sm" circle variant="light" color="gray">
                {count}
            </Badge>
            <FaChevronDown
                size={10}
                color="var(--mantine-color-dimmed)"
                style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
            {!expanded && (
                <Text size="xs" c="dimmed">
                    Tap to show
                </Text>
            )}
        </Group>
    </UnstyledButton>
);

const YearHeading = ({ year, items }: { year: string; items: OrderUI[] }) => {
    const collected = items.filter((item) => item.collected).length;

    return (
        <Group
            justify="space-between"
            wrap="nowrap"
            pb={6}
            style={{ borderBottom: "2px solid var(--mantine-color-default-border)" }}
        >
            <Title order={4}>Academic year {year}</Title>
            {collected === items.length ? (
                <Badge color="green" leftSection={<FaCheck size={10} />}>
                    All done
                </Badge>
            ) : (
                <Text size="sm" c="dimmed">
                    {collected} of {items.length} collected
                </Text>
            )}
        </Group>
    );
};

/** The To collect cards, then the Collected ones (which can be folded away) */
const ItemGroups = ({
    items,
    startCollapsed,
    onCollect,
    onUndo,
}: {
    items: OrderUI[];
    startCollapsed: boolean;
    onCollect: (row: OrderUI) => void;
    onUndo: (row: OrderUI) => void;
}) => {
    const { toCollect, collected } = splitByCollected(items);
    const [collectedShown, setCollectedShown] = useState(!startCollapsed);

    return (
        <Stack gap="md">
            {toCollect.length > 0 && (
                <Stack gap="xs">
                    <SectionHeading title="To collect" count={toCollect.length} />
                    <CardGrid>
                        {toCollect.map((row) => (
                            <ItemCard
                                key={row.itemID}
                                row={row}
                                onCollect={() => onCollect(row)}
                                onUndo={() => onUndo(row)}
                            />
                        ))}
                    </CardGrid>
                </Stack>
            )}

            {collected.length > 0 && (
                <Stack gap="xs">
                    <CollectedToggle
                        count={collected.length}
                        expanded={collectedShown}
                        onToggle={() => setCollectedShown((shown) => !shown)}
                    />
                    <Collapse expanded={collectedShown}>
                        <CardGrid>
                            {collected.map((row) => (
                                <ItemCard
                                    key={row.itemID}
                                    row={row}
                                    onCollect={() => onCollect(row)}
                                    onUndo={() => onUndo(row)}
                                />
                            ))}
                        </CardGrid>
                    </Collapse>
                </Stack>
            )}
        </Stack>
    );
};

/** The cards in a single column at every screen size: easiest to scan top to bottom */
const CardGrid = ({ children }: { children: React.ReactNode }) => (
    <Stack gap="xs">{children}</Stack>
);

const ItemCard = ({
    row,
    onCollect,
    onUndo,
}: {
    row: OrderUI;
    onCollect: () => void;
    onUndo: () => void;
}) => {
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
                        {row.collected && (
                            <ThemeIcon color="green" size="sm" radius="xl" mt={2} flex="none">
                                <FaCheck size={9} />
                            </ThemeIcon>
                        )}
                        <Text fw={700} lh={1.25}>
                            {row.item}
                        </Text>
                        {row.quantity > 1 && (
                            <Badge
                                color="orange"
                                variant="filled"
                                flex="none" // never squash the quantity when the name wraps
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
                    <Button
                        variant="default"
                        size="md"
                        h={44}
                        flex="none"
                        leftSection={<FaUndo size={12} />}
                        title="Mark as not collected"
                        aria-label={`Undo collecting ${label}`}
                        onClick={onUndo}
                    >
                        Undo
                    </Button>
                ) : (
                    <Button
                        size="md"
                        h={44}
                        flex="none"
                        color="green"
                        aria-label={`Collect ${label}`}
                        onClick={onCollect}
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
    // The item just collected, so a mis-tap can be undone even if it has moved into a folded group
    const [justCollected, setJustCollected] = useState<OrderUI | null>(null);
    // The item whose Undo button was tapped, waiting for confirmation (kept after closing so the
    // dialog text doesn't change while it fades out)
    const [confirmUndo, setConfirmUndo] = useState<OrderUI | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const askToUndo = (row: OrderUI) => {
        setConfirmUndo(row);
        setConfirmOpen(true);
    };

    useEffect(() => {
        if (!justCollected) return;
        const timer = setTimeout(() => setJustCollected(null), UNDO_BAR_MS);
        return () => clearTimeout(timer);
    }, [justCollected]);

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
                setJustCollected(collected ? row : null);
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
    // Decided from the total, which never changes while collecting, so a group can't snap shut mid-way
    const collapseCollected = rows.length > COLLAPSE_COLLECTED_ABOVE;
    const years = groupByYear(rows);

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

            {years.length > 1 ? (
                // Several academic years: one clearly labelled section per year
                years.map(({ year, items }) => (
                    <Stack key={`${shortcode}-${year}`} gap="md">
                        <YearHeading year={year} items={items} />
                        <ItemGroups
                            items={items}
                            startCollapsed={collapseCollected}
                            onCollect={(row) => toggle(row, true)}
                            onUndo={askToUndo}
                        />
                    </Stack>
                ))
            ) : (
                <ItemGroups
                    key={shortcode}
                    items={rows}
                    startCollapsed={collapseCollected}
                    onCollect={(row) => toggle(row, true)}
                    onUndo={askToUndo}
                />
            )}

            {justCollected && (
                // Fixed to the bottom; the wrapper ignores clicks so only the bar itself is clickable
                <Affix
                    position={{ bottom: 16, left: 0, right: 0 }}
                    zIndex={200}
                    style={{ pointerEvents: "none" }}
                >
                    <Paper
                        withBorder
                        shadow="md"
                        radius="md"
                        p="sm"
                        role="status"
                        mx="auto"
                        maw={560}
                        w="calc(100% - 32px)"
                        style={{ pointerEvents: "auto" }}
                    >
                        <Group justify="space-between" wrap="nowrap">
                            <Group gap="sm" wrap="nowrap" miw={0}>
                                <FaCheck color="var(--mantine-color-green-6)" />
                                <Text size="sm" lineClamp={2}>
                                    Collected <b>{justCollected.item}</b> ({justCollected.variant})
                                </Text>
                            </Group>
                            <Button
                                variant="light"
                                color="gray"
                                size="md"
                                h={44}
                                flex="none" // keep "Undo" readable however long the item name is
                                onClick={() => toggle(justCollected, false)}
                            >
                                Undo
                            </Button>
                        </Group>
                    </Paper>
                </Affix>
            )}

            <ConfirmModal
                opened={confirmOpen}
                close={() => setConfirmOpen(false)}
                confirmButtonText="Yes, mark as not collected"
                onConfirm={async () => {
                    if (confirmUndo) toggle(confirmUndo, false);
                }}
            >
                <Text>
                    Mark{" "}
                    <b>
                        {confirmUndo?.item} ({confirmUndo?.variant})
                    </b>{" "}
                    as <b>not collected</b>? It will go back to the To collect list, so it could be
                    handed out again.
                </Text>
            </ConfirmModal>
        </Stack>
    );
};
