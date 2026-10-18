"use client";

/**
 * Which academic years' orders are shown. Always visible rather than tucked away, so it is obvious
 * why an older order might be missing: one chip per year, tap to include or leave out.
 */
import { Chip, Group, Stack, Text } from "@mantine/core";
import React, { useEffect, useState } from "react";

export const AcademicYearFilter = ({
    years,
    value,
    onChange,
}: {
    years: string[];
    value: string[];
    onChange: (years: string[]) => void;
}) => {
    const [showHint, setShowHint] = useState(false);

    useEffect(() => {
        if (!showHint) return;
        const timer = setTimeout(() => setShowHint(false), 3000);
        return () => clearTimeout(timer);
    }, [showHint]);

    return (
        <Stack gap={4}>
            <Group
                gap="sm"
                align="center"
                role="group"
                aria-label="Academic years to show orders from"
            >
                <Text size="sm" fw={600} c="dimmed">
                    Orders from
                </Text>
                <Chip.Group
                    multiple
                    value={value}
                    onChange={(selected) => {
                        // Never end up with no year selected (that would show nothing)
                        if (selected.length === 0) return setShowHint(true);
                        onChange(selected);
                    }}
                >
                    <Group gap={6}>
                        {[...years]
                            .sort()
                            .reverse()
                            .map((year) => (
                                <Chip key={year} value={year} size="md" variant="outline">
                                    {year}
                                </Chip>
                            ))}
                    </Group>
                </Chip.Group>
            </Group>
            {showHint && (
                <Text size="xs" c="orange" role="status">
                    Keep at least one academic year selected
                </Text>
            )}
        </Stack>
    );
};
