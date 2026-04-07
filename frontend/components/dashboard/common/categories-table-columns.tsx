"use client";

import { DataTableColumnHeader } from "@/components/dashboard/common/data-table-column-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

export type CategoryRow = {
    id: string;
    storeId: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

function StatusToggle({
    isActive,
    onToggle,
    disabled = false
}: {
    isActive: boolean;
    onToggle: (val: boolean) => Promise<void>;
    disabled?: boolean;
}) {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isUpdating || disabled) return;

        setIsUpdating(true);
        try {
            await onToggle(!isActive);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
                <button
                    onClick={handleToggle}
                    disabled={isUpdating || disabled}
                    className={cn(
                        "relative inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-300 select-none cursor-pointer",
                        "border shadow-xs active:scale-95 disabled:opacity-70 disabled:scale-100",
                        isActive
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-muted/40 border-muted-foreground/20 text-muted-foreground hover:bg-muted/60"
                    )}
                >
                    <span className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center">
                        {isActive && !isUpdating && (
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        )}
                        {!isUpdating ? (
                            <span className={cn(
                                "relative inline-flex h-1.5 w-1.5 rounded-full",
                                isActive ? "bg-emerald-500" : "bg-muted-foreground/50",
                            )} />
                        ) : (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        )}
                    </span>
                    <span className="leading-none">{isActive ? "Active" : "Hidden"}</span>
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px] font-medium px-2 py-1">
                {isActive ? "Click to hide from customers" : "Click to make visible to customers"}
            </TooltipContent>
        </Tooltip>
    );
}

type CategoryColumnsParams = {
    onEdit: (category: CategoryRow) => void;
    onDelete: (category: CategoryRow) => void;
    onStatusToggle: (category: CategoryRow, isActive: boolean) => Promise<void>;
};

export function getCategoriesTableColumns({
    onEdit,
    onDelete,
    onStatusToggle,
}: CategoryColumnsParams): ColumnDef<CategoryRow>[] {
    return [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Name" className="-ml-3" />
            ),
            cell: ({ row }) => (
                <span className="font-medium">{row.original.name}</span>
            ),
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Description" className="-ml-3" />
            ),
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {row.original.description || "—"}
                </span>
            ),
        },
        {
            accessorKey: "isActive",
            header: ({ column }) => (
                <div className="text-left">
                    <DataTableColumnHeader column={column} title="Status" className="-ml-3" />
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-left">
                    <StatusToggle
                        isActive={row.original.isActive}
                        onToggle={(val) => onStatusToggle(row.original, val)}
                    />
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-30">
                            <DropdownMenuItem
                                key="edit"
                                onSelect={() => onEdit(row.original)}
                            >
                                <Pencil className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                key="delete"
                                onSelect={() => onDelete(row.original)}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="h-4 w-4 text-destructive" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ];
}
