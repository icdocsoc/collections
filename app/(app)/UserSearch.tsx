"use client";

import { BuyerItemsList } from "@/components/BuyerItemsList";
import { UserInfo } from "@/components/UserInfo";
import { BuyerItemsTable } from "@/components/tables/BuyerItemsTable";
import { OrderResponse } from "@/lib/crud/purchase";
import { AcademicYear } from "@/lib/eactivities";
import { normaliseShortcode } from "@/lib/util";
import {
    Group,
    TextInput,
    Button,
    Alert,
    Box,
    CloseButton,
    Container,
    Center,
    Stack,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { FaCog, FaSearch, FaTimesCircle } from "react-icons/fa";

import { PageActions } from "./PageActions";
import styles from "./UserSearch.module.scss";

interface UserSearchProps {
    currentAcademicYear: AcademicYear;
    validAcaemicYears: string[];
}

export const UserSearch: React.FC<UserSearchProps> = ({
    currentAcademicYear,
    validAcaemicYears,
}) => {
    const [error, setError] = useState<string | null>(null);
    const [actionsError, setActionsError] = useState<string | null>(null);
    const [purchases, setPurchases] = useState<OrderResponse[]>([]);
    const [isPending, startTransition] = useTransition();
    // Phones only: show the admin tools (see UserSearch.module.scss)
    const [adminToolsOpen, { toggle: toggleAdminTools }] = useDisclosure(false);

    const searchParams = useSearchParams();
    const router = useRouter();
    const shortcodeURLParam = useMemo(() => searchParams.get("shortcode") || "", [searchParams]);

    // Form
    // 2 fields: shortcode & academic year purcahses.
    // Default value of shortcode is from the URL if possible
    const form = useForm({
        initialValues: { shortcode: shortcodeURLParam, academicYears: [currentAcademicYear] },

        validate: {
            shortcode: (value) => {
                if (typeof value !== "string") return "Please enter a shortcode";
                return;
            },
        },
    });

    const fetchPurchases = useCallback(
        async (shortcode: string) => {
            const res = await fetch(
                `/api/purchases/${shortcode}?` +
                    new URLSearchParams({
                        academicYears: form.getValues().academicYears.join(","),
                    }),
                {
                    next: { tags: [`purchases:${shortcode}`] },
                },
            );
            if (!res.ok) {
                setError("An error occurred");
                return;
            }

            const purchases = await res.json();
            if (purchases.status === "error") {
                setError(purchases.message);
                setPurchases([]);
            } else {
                setPurchases(purchases.orders);
            }
        },
        [form],
    );

    // This looks a bit weird, but effectively prevent an infinite loop of fetching purchases
    const [prevURLParam, setPrevURLParam] = useState(shortcodeURLParam);
    useEffect(() => {
        if (!shortcodeURLParam) {
            // only allow one rerender when the shortcode is clear
            // by tracking the previous value
            if (prevURLParam) {
                setPurchases([]);
                form.setFieldValue("shortcode", "");
                setPrevURLParam("");
            }
        }
    }, [shortcodeURLParam, prevURLParam, form]);

    // Fetch purchases if academic year changes
    form.watch("academicYears", (academicYears) => {
        if (form.getValues().shortcode) {
            startTransition(async () => {
                setError(null);
                await fetchPurchases(form.getValues().shortcode);
            });
        }
    });

    const submitAction = useCallback(
        ({ shortcode: enteredShortcode }: { shortcode: string }) => {
            const shortcode = normaliseShortcode(enteredShortcode);
            form.setFieldValue("shortcode", shortcode);
            startTransition(async () => {
                setError(null);
                await fetchPurchases(shortcode);
                router.push("/?shortcode=" + shortcode);
            });
        },
        [router, fetchPurchases, form],
    );

    const clearSearch = () => {
        setPurchases([]);
        router.push("/");
    };

    // Run fetchPurchases on initial render
    useEffect(() => {
        if (shortcodeURLParam) {
            startTransition(async () => {
                await fetchPurchases(shortcodeURLParam);
            });
        }
    }, []);

    return (
        <Container w="100%" px={0}>
            <Stack gap="lg">
                {actionsError && (
                    <Alert title="Error" color="red" mt="md" icon={<FaTimesCircle />}>
                        {actionsError}
                    </Alert>
                )}
                <Button
                    hiddenFrom="sm"
                    ml="auto"
                    mb={-8}
                    variant="subtle"
                    color="gray"
                    size="compact-sm"
                    leftSection={<FaCog />}
                    aria-expanded={adminToolsOpen}
                    onClick={toggleAdminTools}
                >
                    {adminToolsOpen ? "Hide" : "Import, sync & filters"}
                </Button>
                <Box className={styles.adminTools} data-open={adminToolsOpen || undefined}>
                    <PageActions
                        currentAcademicYear={currentAcademicYear}
                        academicYears={validAcaemicYears}
                        formHook={form}
                        setActionsError={setActionsError}
                    />
                </Box>
                <Center>
                    <Stack w="100%">
                        <form
                            style={{
                                width: "100%",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                            onSubmit={form.onSubmit(submitAction)}
                            // eslint-disable-next-line @typescript-eslint/no-empty-function
                            action={() => {}}
                        >
                            <Group w="100%" wrap="nowrap">
                                <TextInput
                                    placeholder="Enter shortcode"
                                    leftSection={<FaSearch />}
                                    flex={1}
                                    miw={0}
                                    required
                                    name="shortcode"
                                    id="shortcode"
                                    // Shortcodes are lowercase logins: stop phone keyboards capitalising/correcting them
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    autoComplete="off"
                                    spellCheck={false}
                                    enterKeyHint="search"
                                    // Phones: clear from inside the field (the Clear button is hidden there)
                                    rightSection={
                                        form.values.shortcode ? (
                                            <CloseButton
                                                hiddenFrom="sm"
                                                aria-label="Clear search"
                                                onClick={clearSearch}
                                            />
                                        ) : null
                                    }
                                    {...form.getInputProps("shortcode")}
                                />
                                <Button loading={isPending} type="submit">
                                    Submit
                                </Button>
                                <Button color="pink" visibleFrom="sm" onClick={clearSearch}>
                                    Clear
                                </Button>
                            </Group>
                        </form>
                        {error && (
                            <Alert title="Error" color="red" mt="md" icon={<FaTimesCircle />}>
                                {error}
                            </Alert>
                        )}
                    </Stack>
                </Center>
                <Center>
                    <UserInfo shortcode={shortcodeURLParam} />
                </Center>

                {!error && (
                    <>
                        {/* Tablet and up: compact table */}
                        <Box visibleFrom="sm">
                            <BuyerItemsTable
                                shortcode={shortcodeURLParam}
                                purchases={purchases}
                                refresh={() => fetchPurchases(shortcodeURLParam)}
                            />
                        </Box>
                        {/* Phones: one card per item */}
                        <Box hiddenFrom="sm">
                            <BuyerItemsList
                                shortcode={shortcodeURLParam}
                                purchases={purchases}
                                refresh={() => fetchPurchases(shortcodeURLParam)}
                                isLoading={isPending}
                            />
                        </Box>
                    </>
                )}
            </Stack>
        </Container>
    );
};
