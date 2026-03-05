"use client";

import { Button } from "@/components/ui/button";
import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

type DataTableColumnHeaderProps<TData, TValue> = {
    column: Column<TData, TValue>;
    title: string;
    className?: string;
};

export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
}: DataTableColumnHeaderProps<TData, TValue>) {
    if (!column.getCanSort()) {
        return <span className={className}>{title}</span>;
    }

    const isSorted = column.getIsSorted();

    return (
        <Button
            variant="ghost"
            className={className}
            onClick={() => column.toggleSorting(isSorted === "asc")}
        >
            {title}
            {
                !isSorted ? <ChevronsUpDown className="h-4 w-4" /> :
                    isSorted === "asc" ?
                        <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            }
        </Button>

    );
}
