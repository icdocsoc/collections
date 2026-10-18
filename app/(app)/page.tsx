import { auth } from "@/auth";
import { getAcademicYear } from "@/lib/config";
import { getAcademicYearsInDB } from "@/lib/crud/academic-year";
import { getImportList } from "@/lib/crud/importCsv";
import { Container, Stack, Title } from "@mantine/core";
import { redirect } from "next/navigation";
import React from "react";

import { ImportsList } from "./ImportsList";
import { UserSearch } from "./UserSearch";

export default async function Index() {
    const session = await auth();

    if (!session) redirect("/auth/login");

    // Get academic years
    const currentAcademicYear = await getAcademicYear();
    const academicYears = await getAcademicYearsInDB();

    const imports = await getImportList();

    return (
        // One narrow column at every screen size: easiest to scan
        <Container size="sm" px={0}>
            <Stack gap="lg">
                <Title order={1} fz={{ base: "h3", sm: "h1" }}>
                    DoCSoc Collection System
                </Title>
                <UserSearch
                    currentAcademicYear={currentAcademicYear}
                    validAcaemicYears={academicYears}
                />
                <ImportsList imports={imports} />
            </Stack>
        </Container>
    );
}
