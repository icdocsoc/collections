// Shared TanStack Table v9 setup: v9 requires features, row models and sort/filter functions to be registered explicitly.
import {
    columnFilteringFeature,
    columnOrderingFeature,
    columnVisibilityFeature,
    createColumnHelper as tanstackCreateColumnHelper,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFn_equals,
    filterFn_includesString,
    filterFn_inNumberRange,
    filterFn_weakEquals,
    rowPaginationFeature,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_basic,
    sortFn_datetime,
    sortFn_text,
    tableFeatures,
    type ColumnDef,
    type RowData,
} from "@tanstack/react-table";

export const features = tableFeatures({
    columnFilteringFeature,
    columnOrderingFeature,
    columnVisibilityFeature,
    rowSortingFeature,
    rowPaginationFeature,
    filteredRowModel: createFilteredRowModel(),
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    filterFns: {
        includesString: filterFn_includesString,
        inNumberRange: filterFn_inNumberRange,
        equals: filterFn_equals,
        weakEquals: filterFn_weakEquals,
    },
    sortFns: {
        alphanumeric: sortFn_alphanumeric,
        text: sortFn_text,
        datetime: sortFn_datetime,
        basic: sortFn_basic,
    },
});

export type AppTableFeatures = typeof features;
export type AppColumnDef<TData extends RowData> = ColumnDef<AppTableFeatures, TData, any>;
export const createColumnHelper = <TData extends RowData>() =>
    tanstackCreateColumnHelper<AppTableFeatures, TData>();
