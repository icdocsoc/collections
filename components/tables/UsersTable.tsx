"use client";

import TanstackTable from "@/components/tables/TanStackTable";
import type { CommitteeMember } from "@/generated/prisma/client";
import { createColumnHelper } from "@/components/tables/tableFeatures";
import React from "react";

import { UserRowActions } from "./UserRowActions";

const columnHelper = createColumnHelper<CommitteeMember>();
const columns = [
    columnHelper.accessor("firstname", {
        cell: (info) => info.getValue(),
        header: "First Name",
        id: "firstName",
        sortFn: "alphanumeric",
    }),
    columnHelper.accessor("surname", {
        cell: (info) => info.getValue(),
        header: "Surname",
        id: "surname",
        sortFn: "alphanumeric",
    }),
    columnHelper.accessor("shortcode", {
        cell: (info) => info.getValue(),
        header: "Shortcode",
        id: "shortcode",
        sortFn: "alphanumeric",
    }),
    columnHelper.accessor("position", {
        cell: (info) => info.getValue(),
        header: "Position",
        id: "position",
        sortFn: "alphanumeric",
    }),
    columnHelper.display({
        header: "Actions",
        cell: (info) => <UserRowActions user={info.row.original} />,
    }),
];

export const UsersTable = ({ users }: { users: CommitteeMember[] }) => {
    return <TanstackTable columns={columns} data={users} enablePagination={false} />;
};
