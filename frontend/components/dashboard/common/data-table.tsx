"use client";

import {
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type RowSelectionState,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Settings2 } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
    loadingText?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyAction?: ReactNode;
    searchColumnId?: string;
    searchPlaceholder?: string;
    defaultPageSize?: number;
    enableRowSelection?: boolean;
    enableDefaultActionBar?: boolean;
    actionBar?: ReactNode;
    getRowId?: (originalRow: TData, index: number) => string;
    renderBulkActions?: (params: {
        selectedRows: TData[];
        selectedCount: number;
        clearSelection: () => void;
    }) => ReactNode;
    onSelectionChange?: (params: {
        selectedRows: TData[];
        selectedCount: number;
        selectedRowIds: Set<string>;
        clearSelection: () => void;
    }) => void;
    rowSelectionDisabled?: boolean;
};

function formatColumnLabel(columnId: string) {
    return columnId
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function DataTable<TData, TValue>({
    columns,
    data,
    size = "md",
    isLoading = false,
    loadingText = "Loading...",
    emptyTitle = "No results",
    emptyDescription,
    emptyAction,
    searchColumnId,
    searchPlaceholder = "Search...",
    defaultPageSize = 20,
    enableRowSelection = false,
    getRowId,
    enableDefaultActionBar = true,
    actionBar,
    renderBulkActions,
    onSelectionChange,
    rowSelectionDisabled = false,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    const selectionColumn = useMemo<ColumnDef<TData, TValue>[]>(
        () =>
            enableRowSelection
                ? [
                    {
                        id: "select",
                        header: ({ table }) => (
                            <Checkbox
                                aria-label="Select all rows"
                                checked={table.getIsAllPageRowsSelected()}
                                onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === 'indeterminate' ? false : checked)}
                                disabled={rowSelectionDisabled}
                                className="size-4 cursor-pointer rounded border border-input bg-background checked:bg-muted-foreground checked:text-foreground"
                            />
                        ),
                        cell: ({ row }) => (
                            <Checkbox
                                aria-label="Select row"
                                checked={row.getIsSelected()}
                                onCheckedChange={(checked) => row.toggleSelected(checked === 'indeterminate' ? false : checked)}
                                disabled={rowSelectionDisabled}
                                className="size-4 cursor-pointer rounded border border-input bg-background checked:bg-muted-foreground checked:text-foreground "
                            />
                        ),
                        enableSorting: false,
                        enableHiding: false,
                        size: 32,
                    },
                ]
                : [],
        [enableRowSelection, rowSelectionDisabled]
    );

    const tableColumns = useMemo(() => [...selectionColumn, ...columns], [selectionColumn, columns]);

    const table = useReactTable({
        data,
        columns: tableColumns,
        getRowId,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        enableRowSelection,
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getCoreRowModel: getCoreRowModel(),
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
        initialState: {
            pagination: {
                pageSize: defaultPageSize,
            },
        },
    });

    const searchableColumn = useMemo(
        () => (searchColumnId ? table.getColumn(searchColumnId) : undefined),
        [searchColumnId, table]
    );

    const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
    const selectedCount = selectedRows.length;

    useEffect(() => {
        onSelectionChange?.({
            selectedRows,
            selectedCount,
            selectedRowIds: new Set(table.getSelectedRowModel().rows.map((row) => String(row.id))),
            clearSelection: () => table.resetRowSelection(),
        });
    }, [onSelectionChange, rowSelection, selectedCount, selectedRows, table]);

    return (
        <div className="pt-3 h-full min-h-0 min-w-0 w-full overflow-hidden flex flex-col">
            {enableDefaultActionBar && <div className="shrink-0 mb-3 bg-background-elevated z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {searchableColumn ? (
                    <Input
                        placeholder={searchPlaceholder}
                        value={(searchableColumn.getFilterValue() as string) ?? ""}
                        onChange={(event) => searchableColumn.setFilterValue(event.target.value)}
                        className="w-full sm:max-w-xs"
                    />
                ) : <div className="flex-1" />}

                <div className="flex items-center gap-2">
                    {enableRowSelection ? renderBulkActions?.({
                        selectedRows,
                        selectedCount,
                        clearSelection: () => table.resetRowSelection(),
                    }) : null}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="sm:ml-auto">
                                <Settings2 className="size-4" /> View
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                    >
                                        {formatColumnLabel(column.id)}
                                    </DropdownMenuCheckboxItem>
                                ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>}
            {actionBar && <div className="shrink-0 mb-3 bg-background-elevated z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{actionBar}</div>}
            {/* Table */}
            <div className="overflow-y-auto overscroll-none overflow-x-auto rounded-md border bg-background-elevated flex-1 min-h-0 min-w-0 w-full">
                <Table>
                    <TableHeader className="sticky top-0 bg-background-elevated-2 z-10 shadow dark:shadow-lg">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="align-middle">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>

                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-44">
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {loadingText}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}
                                            style={{
                                                width: cell.column.getSize()
                                            }}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-44">
                                    <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
                                        <div>
                                            <p className="text-sm font-medium">{emptyTitle}</p>
                                            {emptyDescription ? (
                                                <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
                                            ) : null}
                                        </div>
                                        {emptyAction}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className={`shrink-0 bg-background-elevated flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-lg"}`}>

                <div className="text-muted-foreground">
                    {table.getSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} item(s) selected
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-6 md:gap-8 lg:gap-10">

                    {/* Page size selector */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className=" text-muted-foreground">Rows per page</span>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => table.setPageSize(Number(value))}
                        >
                            <SelectTrigger className="w-18">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 20, 50, 100].map((size) => (
                                    <SelectItem key={size} value={`${size}`}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <span className="text-muted-foreground">
                        Page
                        <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={table.getState().pagination.pageIndex + 1}
                            onFocus={(event) => event.currentTarget.select()}
                            onKeyDown={(event) => {
                                const allowedKeys = new Set([
                                    "Backspace",
                                    "Delete",
                                    "Tab",
                                    "Escape",
                                    "Enter",
                                    "ArrowLeft",
                                    "ArrowRight",
                                    "Home",
                                    "End",
                                ]);

                                if (allowedKeys.has(event.key)) return;
                                if (event.metaKey || event.ctrlKey || event.altKey) return;
                                if (!/^[0-9]$/.test(event.key)) {
                                    event.preventDefault();
                                }
                            }}
                            onPaste={(event) => {
                                const pastedText = event.clipboardData.getData("text");
                                if (!/^\d+$/.test(pastedText.trim())) {
                                    event.preventDefault();
                                }
                            }}
                            onChange={(e) => {
                                const inputValue = e.target.value;
                                if (inputValue === "") return;
                                if (!/^\d+$/.test(inputValue)) return;
                                const page = Math.max(0, Math.min(Number(inputValue) - 1, table.getPageCount() - 1));
                                table.setPageIndex(page);
                            }}

                            className="m-2 w-10 text-center p-0 h-8 tabular-nums"
                            disabled={table.getPageCount() === 1}
                        />

                        of {table.getPageCount() || 1}
                    </span>

                    {/* Pagination Controls */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => table.firstPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <ChevronsLeft />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <ChevronLeft />
                        </Button>

                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <ChevronRight />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => table.lastPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <ChevronsRight />
                        </Button>
                    </div>



                </div>
            </div>
        </div>
    );
}
