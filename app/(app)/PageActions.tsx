import { AcademicYear } from "@/lib/eactivities";
import { Paper, Group } from "@mantine/core";
import { UseFormReturnType } from "@mantine/form";

import { CSVImport } from "./CSVImport";
import { SyncEActivities } from "./SyncEActivities";

export const PageActions = ({
    formHook,
    academicYears,
    currentAcademicYear,
    setActionsError,
}: {
    formHook: UseFormReturnType<{ academicYears: AcademicYear[]; shortcode: string }>;
    academicYears: string[];
    currentAcademicYear: string;
    setActionsError: (error: string | null) => void;
}) => {
    return (
        <Paper p="lg" withBorder>
            <Group>
                <SyncEActivities
                    setActionsError={setActionsError}
                    academicYears={academicYears}
                    currentlySelectedAcademicYears={formHook.getValues().academicYears}
                />
                <CSVImport
                    academicYears={academicYears}
                    currentAcademicYear={currentAcademicYear}
                />
            </Group>
        </Paper>
    );
};
