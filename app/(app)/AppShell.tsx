"use client";

import { DoCSocBanner } from "@/components/DoCSocBanner";
import { LogoutButton } from "@/components/auth/LogoutButton";
import {
    AppShell,
    Box,
    Burger,
    Button,
    Container,
    Group,
    GroupProps,
    NavLink,
    Switch,
    useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { FaMoon, FaSun } from "react-icons/fa6";

// From https://mantine.dev/app-shell/?e=MobileNavbar&s=code

const NAV_LINKS = [
    { href: "/", label: "Home" },
    { href: "/settings", label: "Settings" },
    { href: "/products", label: "Products" },
];

const ThemeToggle = (props: GroupProps) => {
    const { colorScheme, toggleColorScheme } = useMantineColorScheme();
    return (
        <Group {...props}>
            <FaSun />
            <Switch checked={colorScheme === "dark"} onChange={() => toggleColorScheme()} />
            <FaMoon />
        </Group>
    );
};

const LinkTo = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const pathname = usePathname();
    return (
        <Button component={Link} href={href} variant={pathname === href ? "light" : "subtle"}>
            {children}
        </Button>
    );
};

export function DoCSocAppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [opened, { toggle, close }] = useDisclosure();

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{ width: 300, breakpoint: "sm", collapsed: { desktop: true, mobile: !opened } }}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md">
                    <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="lg" />
                    <Group justify="space-between" style={{ flex: 1 }}>
                        <DoCSocBanner width="4em" />
                        <Group ml="xl" gap={5} visibleFrom="sm" wrap="nowrap">
                            {NAV_LINKS.map(({ href, label }) => (
                                <LinkTo key={href} href={href}>
                                    {label}
                                </LinkTo>
                            ))}
                            <LogoutButton />
                            <ThemeToggle ml="lg" />
                        </Group>
                    </Group>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar py="md" px={4}>
                {NAV_LINKS.map(({ href, label }) => (
                    <NavLink
                        key={href}
                        component={Link}
                        href={href}
                        label={label}
                        active={pathname === href}
                        onClick={close}
                        py="md"
                    />
                ))}
                <Group justify="space-between" px="md" mt="lg">
                    <LogoutButton />
                    <ThemeToggle />
                </Group>
            </AppShell.Navbar>

            <AppShell.Main>
                <Container size="xl">{children}</Container>
            </AppShell.Main>
        </AppShell>
    );
}

export default DoCSocAppShell;
