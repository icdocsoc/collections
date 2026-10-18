"use client";

/**
 * A buyer's items: a progress summary, then one card per item grouped by state (To collect first,
 * then Collected, Forfeited and Refunded), and by academic year when there is more than one. The
 * same view at every screen size, as a single column.
 */
import { ConfirmModal } from "@/components/ConfirmModal";
import type { CollectionState } from "@/generated/prisma/enums";
import { setItemState, type OrderResponse } from "@/lib/crud/purchase";
import {
    collectionProgress,
    flattenPurchases,
    groupByYear,
    splitByState,
    type OrderUI,
} from "@/lib/purchases";
import { formatDateDDMMYYYY } from "@/lib/util";
import {
    ActionIcon,
    Affix,
    Alert,
    Badge,
    Box,
    Button,
    Collapse,
    Group,
    Loader,
    Menu,
    Paper,
    Skeleton,
    Stack,
    Text,
    Title,
    UnstyledButton,
} from "@mantine/core";
import React, { useEffect, useOptimistic, useState, useTransition } from "react";
import {
    FaBan,
    FaCheck,
    FaChevronDown,
    FaEllipsisV,
    FaHourglassHalf,
    FaMoneyBillWave,
    FaTimesCircle,
    FaUndo,
} from "react-icons/fa";

import styles from "./BuyerItemsList.module.scss";

/** Above this many items in total the finished groups start folded away, so what is left stays on screen */
const COLLAPSE_FINISHED_ABOVE = 8;

/** How long the "Undo" bar stays after collecting an item (ms) */
const UNDO_BAR_MS = 6000;

const STATES: Record<
    CollectionState,
    { label: string; section: string; color: string; icon: React.ReactNode }
> = {
    UNCOLLECTED: {
        label: "Not collected",
        section: "To collect",
        color: "orange",
        icon: <FaHourglassHalf size={9} />,
    },
    COLLECTED: {
        label: "Collected",
        section: "Collected",
        color: "green",
        icon: <FaCheck size={9} />,
    },
    FORFEITED: { label: "Forfeited", section: "Forfeited", color: "red", icon: <FaBan size={9} /> },
    REFUNDED: {
        label: "Refunded",
        section: "Refunded",
        color: "grape",
        icon: <FaMoneyBillWave size={9} />,
    },
};

/** What an item can be changed to from here (FORFEITED is only set in bulk, on the Forfeit page) */
const CHANGE_TO: { state: CollectionState; label: string; icon: React.ReactNode }[] = [
    { state: "UNCOLLECTED", label: "Mark as not collected", icon: <FaUndo size={12} /> },
    { state: "COLLECTED", label: "Mark as collected", icon: <FaCheck size={12} /> },
    { state: "REFUNDED", label: "Mark as refunded", icon: <FaMoneyBillWave size={12} /> },
];

/** A change waiting to be confirmed */
interface PendingChange {
    row: OrderUI;
    to: CollectionState;
}

const ConfirmText = ({ row, to }: PendingChange) => {
    const name = (
        <b>
            {row.item} ({row.variant})
        </b>
    );
    const now = STATES[row.state].label.toLowerCase();
    switch (to) {
        case "UNCOLLECTED":
            return (
                <Text>
                    Mark {name} as <b>not collected</b>? It will go back to the To collect list, so
                    it could be handed out{row.state === "COLLECTED" ? " again" : ""}.
                </Text>
            );
        case "COLLECTED":
            return (
                <Text>
                    Mark {name} as <b>collected</b>? It is currently {now}: only do this if you are
                    handing it over now.
                </Text>
            );
        case "REFUNDED":
            return (
                <Text>
                    Mark {name} as <b>refunded</b>? Only do this once the student has had their
                    money back. It won&apos;t be handed out.
                </Text>
            );
        default:
            return null;
    }
};

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

const SectionToggle = ({
    title,
    count,
    expanded,
    onToggle,
}: {
    title: string;
    count: number;
    expanded: boolean;
    onToggle: () => void;
}) => (
    <UnstyledButton onClick={onToggle} aria-expanded={expanded} py={4}>
        <Group gap="xs">
            <Text fw={700} size="xs" tt="uppercase" c="dimmed" lts={0.5}>
                {title}
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

/** "x of y collected", or why there is nothing to count */
const ProgressText = ({ items }: { items: OrderUI[] }) => {
    const { toCollect, collected, expected } = collectionProgress(items);

    if (expected === 0) {
        return (
            <Text size="sm" c="dimmed">
                Nothing to collect
            </Text>
        );
    }
    if (toCollect === 0) {
        return (
            <Badge color="green" leftSection={<FaCheck size={10} />}>
                All done
            </Badge>
        );
    }
    return (
        <Text size="sm" c="dimmed">
            {collected} of {expected} collected
        </Text>
    );
};

const YearHeading = ({ year, items }: { year: string; items: OrderUI[] }) => (
    <Group
        justify="space-between"
        wrap="nowrap"
        pb={6}
        style={{ borderBottom: "2px solid var(--mantine-color-default-border)" }}
    >
        <Title order={4}>Academic year {year}</Title>
        <ProgressText items={items} />
    </Group>
);

/** A group of finished items (collected, forfeited or refunded), which can be folded away */
const FoldableSection = ({
    title,
    items,
    startCollapsed,
    renderCard,
}: {
    title: string;
    items: OrderUI[];
    startCollapsed: boolean;
    renderCard: (row: OrderUI) => React.ReactNode;
}) => {
    const [shown, setShown] = useState(!startCollapsed);

    if (items.length === 0) return null;

    return (
        <Stack gap="xs">
            <SectionToggle
                title={title}
                count={items.length}
                expanded={shown}
                onToggle={() => setShown((current) => !current)}
            />
            <Collapse expanded={shown}>
                <Stack gap="xs">{items.map(renderCard)}</Stack>
            </Collapse>
        </Stack>
    );
};

/** The To collect cards, then the Collected, Forfeited and Refunded ones (which can be folded away) */
const ItemGroups = ({
    items,
    startCollapsed,
    onCollect,
    onChange,
}: {
    items: OrderUI[];
    startCollapsed: boolean;
    onCollect: (row: OrderUI) => void;
    onChange: (change: PendingChange) => void;
}) => {
    const byState = splitByState(items);
    const renderCard = (row: OrderUI) => (
        <ItemCard
            key={row.itemID}
            row={row}
            onCollect={() => onCollect(row)}
            onChange={(to) => onChange({ row, to })}
        />
    );

    return (
        <Stack gap="md">
            {byState.UNCOLLECTED.length > 0 && (
                <Stack gap="xs">
                    <SectionHeading
                        title={STATES.UNCOLLECTED.section}
                        count={byState.UNCOLLECTED.length}
                    />
                    <Stack gap="xs">{byState.UNCOLLECTED.map(renderCard)}</Stack>
                </Stack>
            )}
            {(["COLLECTED", "FORFEITED", "REFUNDED"] as const).map((state) => (
                <FoldableSection
                    key={state}
                    title={STATES[state].section}
                    items={byState[state]}
                    startCollapsed={startCollapsed}
                    renderCard={renderCard}
                />
            ))}
        </Stack>
    );
};

const ItemCard = ({
    row,
    onCollect,
    onChange,
}: {
    row: OrderUI;
    onCollect: () => void;
    onChange: (to: CollectionState) => void;
}) => {
    const label = `${row.item}, ${row.variant}`;
    const state = STATES[row.state];
    const changeItems = CHANGE_TO.filter((option) => option.state !== row.state).map((option) => (
        <Menu.Item
            key={option.state}
            leftSection={option.icon}
            onClick={() => onChange(option.state)}
        >
            {option.label}
        </Menu.Item>
    ));

    return (
        <Paper withBorder radius="md" p="sm" className={styles.card} data-state={row.state}>
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
                    <Group gap={6} wrap="wrap">
                        <Badge
                            size="sm"
                            variant={row.state === "UNCOLLECTED" ? "light" : "filled"}
                            color={state.color}
                            leftSection={state.icon}
                        >
                            {state.label}
                        </Badge>
                        <Text size="xs" c="dimmed">
                            Order #{row.orderNo} · {formatDateDDMMYYYY(new Date(row.date))}
                        </Text>
                    </Group>
                </Stack>

                {row.state === "UNCOLLECTED" ? (
                    <Group gap={6} wrap="nowrap" flex="none">
                        <Button
                            size="md"
                            h={44}
                            color="green"
                            aria-label={`Collect ${label}`}
                            onClick={onCollect}
                        >
                            Collect
                        </Button>
                        <Menu position="bottom-end" withinPortal>
                            <Menu.Target>
                                <ActionIcon
                                    variant="default"
                                    size={44}
                                    aria-label={`More options for ${label}`}
                                >
                                    <FaEllipsisV size={14} />
                                </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>{changeItems}</Menu.Dropdown>
                        </Menu>
                    </Group>
                ) : (
                    <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                            <Button
                                variant="default"
                                size="md"
                                h={44}
                                flex="none"
                                rightSection={<FaChevronDown size={10} />}
                                aria-label={`Change ${label}`}
                            >
                                Change
                            </Button>
                        </Menu.Target>
                        <Menu.Dropdown>{changeItems}</Menu.Dropdown>
                    </Menu>
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
    // A change picked from an item's menu, waiting for confirmation (kept after closing so the
    // dialog text doesn't change while it fades out)
    const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const askToChange = (change: PendingChange) => {
        setPendingChange(change);
        setConfirmOpen(true);
    };

    useEffect(() => {
        if (!justCollected) return;
        const timer = setTimeout(() => setJustCollected(null), UNDO_BAR_MS);
        return () => clearTimeout(timer);
    }, [justCollected]);

    // Show a change straight away; it settles to the real value once saved (or reverts if it fails)
    const [rows, setStateOptimistically] = useOptimistic(
        flattenPurchases(purchases),
        (current, update: { itemID: number; state: CollectionState }) =>
            current.map((row) =>
                row.itemID === update.itemID ? { ...row, state: update.state } : row,
            ),
    );

    const changeState = (row: OrderUI, state: CollectionState) => {
        // Ignore taps while saving: the list reorders, so a quick second tap would hit another item
        if (isSaving) return;
        setError(null);
        startTransition(async () => {
            setStateOptimistically({ itemID: row.itemID, state });
            try {
                await setItemState(row.orderNo, row.itemID, state, shortcode);
                setJustCollected(state === "COLLECTED" && row.state === "UNCOLLECTED" ? row : null);
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

    const byState = splitByState(rows);
    const { toCollect, collected, expected } = collectionProgress(rows);
    // Decided from the total, which never changes while collecting, so a group can't snap shut mid-way
    const collapseFinished = rows.length > COLLAPSE_FINISHED_ABOVE;
    const years = groupByYear(rows);
    const notCounted = [
        byState.FORFEITED.length > 0 && `${byState.FORFEITED.length} forfeited`,
        byState.REFUNDED.length > 0 && `${byState.REFUNDED.length} refunded`,
    ].filter(Boolean);

    return (
        <Stack gap="md">
            <Paper withBorder radius="md" p="md">
                <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs">
                        <Text fw={700}>
                            {expected === 0
                                ? "Nothing to collect"
                                : `${collected} of ${expected} collected`}
                        </Text>
                        {isSaving && <Loader size="xs" />}
                    </Group>
                    {toCollect > 0 ? (
                        <Badge color="orange" variant="light">
                            {toCollect} to go
                        </Badge>
                    ) : (
                        expected > 0 && (
                            <Badge color="green" leftSection={<FaCheck size={10} />}>
                                All done
                            </Badge>
                        )
                    )}
                </Group>
                {expected > 0 && (
                    <Group gap={4} wrap="nowrap" mt="sm" aria-hidden>
                        {[...byState.COLLECTED, ...byState.UNCOLLECTED].map((row) => (
                            <Box
                                key={row.itemID}
                                flex={1}
                                className={styles.segment}
                                data-collected={row.state === "COLLECTED" || undefined}
                            />
                        ))}
                    </Group>
                )}
                {notCounted.length > 0 && (
                    <Text size="xs" c="dimmed" mt="xs">
                        Not counted: {notCounted.join(", ")}
                    </Text>
                )}
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
                            startCollapsed={collapseFinished}
                            onCollect={(row) => changeState(row, "COLLECTED")}
                            onChange={askToChange}
                        />
                    </Stack>
                ))
            ) : (
                <ItemGroups
                    key={shortcode}
                    items={rows}
                    startCollapsed={collapseFinished}
                    onCollect={(row) => changeState(row, "COLLECTED")}
                    onChange={askToChange}
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
                                onClick={() => changeState(justCollected, "UNCOLLECTED")}
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
                confirmButtonText={
                    pendingChange
                        ? `Yes, ${CHANGE_TO.find((option) => option.state === pendingChange.to)?.label.toLowerCase()}`
                        : undefined
                }
                onConfirm={async () => {
                    if (pendingChange) changeState(pendingChange.row, pendingChange.to);
                }}
            >
                {pendingChange && <ConfirmText {...pendingChange} />}
            </ConfirmModal>
        </Stack>
    );
};
