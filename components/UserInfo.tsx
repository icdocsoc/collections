import {
    Alert,
    Anchor,
    Avatar,
    Box,
    Group,
    List,
    Loader,
    Paper,
    Skeleton,
    Stack,
    Text,
    Title,
} from "@mantine/core";
import { useEffect, useState, useTransition } from "react";
import { FaInfoCircle } from "react-icons/fa";
import { FaUser } from "react-icons/fa6";

export const UserInfo = ({ shortcode }: { shortcode: string }) => {
    const [user, setUserData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        cid: "",
    });
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            try {
                if (!shortcode) {
                    return;
                }
                const res = await fetch(`/api/user/${shortcode}`);
                const data = await res.json();
                setUserData(
                    data?.user ?? {
                        firstName: "",
                        lastName: "",
                        email: "",
                        cid: "",
                    },
                );
            } catch (err) {
                console.error("Error fetching user:", err);
            }
        });
    }, [shortcode, startTransition]);

    if (!shortcode) {
        return (
            <Alert icon={<FaInfoCircle />} title="Info">
                Enter a shortcode to see purchases
            </Alert>
        );
    }

    const fullName = `${user.firstName} ${user.lastName}`.trim();

    return (
        <>
            {/* Phones: compact header */}
            <Group hiddenFrom="sm" w="100%" wrap="nowrap" gap="md">
                {isLoading ? (
                    <Skeleton h={56} radius="md" />
                ) : (
                    fullName && (
                        <>
                            <Avatar name={fullName} color="initials" size="lg" radius="xl" />
                            <Stack gap={0} miw={0}>
                                <Text fw={700} size="lg" lh={1.3} truncate>
                                    {fullName}
                                </Text>
                                <Text size="sm" c="dimmed" truncate>
                                    {shortcode} · CID {user.cid}
                                </Text>
                                <Anchor size="sm" href={`mailto:${user.email}`} truncate>
                                    {user.email}
                                </Anchor>
                            </Stack>
                        </>
                    )
                )}
            </Group>
            {/* Tablet and up: card */}
            <Paper visibleFrom="sm" withBorder w="fit-content" p="lg">
                <Group gap="xl">
                    <Box>
                        <FaUser size={96} />
                    </Box>
                    <Stack>
                        <Title order={4}>Buyer Info</Title>
                        {isLoading ? (
                            <Loader />
                        ) : (
                            <List listStyleType="none">
                                <List.Item>
                                    <strong>Name:</strong> {user?.firstName} {user?.lastName}
                                </List.Item>
                                <List.Item>
                                    <strong>Email:</strong>{" "}
                                    <Anchor href={`mailto:${user?.email}`}>{user?.email}</Anchor>
                                </List.Item>
                                <List.Item>
                                    <strong>CID:</strong> {user?.cid}
                                </List.Item>
                            </List>
                        )}
                    </Stack>
                </Group>
            </Paper>
        </>
    );
};
