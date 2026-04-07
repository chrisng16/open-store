"use client";

import { DataTableColumnHeader } from "@/components/dashboard/common/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

export type ProductCategoryOption = {
    id: string;
    name: string;
    isActive: boolean;
};

export type ProductRow = {
    id: string;
    name: string;
    description: string | null;
    unitAmount: number;
    imageUrl?: string | null;
    categoryId: string | null;
    category?: ProductCategoryOption | null;
    isActive: boolean;
    dietaryTags: string[] | null;
    optionLists?: {
        name: string;
        selectionNode: string;
        minNumOptions: number;
        maxNumOptions: number;
        isOptional: boolean;
        options: {
            name: string;
            unitAmount: number;
            isDefault: boolean;
            sortOrder: number;
        }[];
    }[];
};

type ProductsColumnsParams = {
    onEdit: (product: ProductRow) => void;
    onDelete: (product: ProductRow) => void;
    onStatusToggle: (product: ProductRow, isActive: boolean) => Promise<void>;
    canEdit: boolean;
    canDelete: boolean;
    canToggleStatus: boolean;
    editDisabledReason?: string;
    deleteDisabledReason?: string;
    statusDisabledReason?: string;
};

function StatusToggle({
    isActive,
    categoryInactive = false,
    onToggle,
    disabled = false,
    disabledReason,
}: {
    isActive: boolean;
    categoryInactive?: boolean;
    onToggle: (val: boolean) => Promise<void>;
    disabled?: boolean;
    disabledReason?: string;
}) {
    const [isUpdating, setIsUpdating] = useState(false);
    const effectivelyHidden = isActive && categoryInactive;

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
                        effectivelyHidden
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                            : isActive
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-muted/40 border-muted-foreground/20 text-muted-foreground hover:bg-muted/60"
                    )}
                >
                    <span className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center">
                        {!isUpdating ? (
                            <span className={cn(
                                "relative inline-flex h-1.5 w-1.5 rounded-full",
                                effectivelyHidden ? "bg-amber-500" : isActive ? "bg-emerald-500" : "bg-muted-foreground/50",
                            )} />
                        ) : (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        )}
                    </span>
                    <span className="leading-none">
                        {effectivelyHidden ? "Hidden" : isActive ? "Active" : "Hidden"}
                    </span>
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px] font-medium px-2 py-1 max-w-44 text-center">
                {disabled && disabledReason
                    ? disabledReason
                    : effectivelyHidden
                        ? "Category is inactive — enable the category to make this visible"
                        : isActive
                            ? "Click to hide from customers"
                            : "Click to make visible to customers"}
            </TooltipContent>
        </Tooltip>
    );
}

export function getProductsTableColumns({
    onEdit,
    onDelete,
    onStatusToggle,
    canEdit,
    canDelete,
    canToggleStatus,
    editDisabledReason,
    deleteDisabledReason,
    statusDisabledReason,
}: ProductsColumnsParams): ColumnDef<ProductRow>[] {
    return [
        {
            accessorKey: "name",
            size: 90,
            minSize: 80,
            maxSize: 100,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Name" className="-ml-3" />
            ),
            cell: ({ row }) => (
                <span className="font-medium truncate">{row.original.name}</span>
            ),
        },
        {
            id: "category",
            accessorFn: (row) => row.category?.name ?? "",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Category" className="-ml-3" />
            ),
            cell: ({ row }) => row.original.category?.name ?? "—",
        },
        {
            id: "options",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Options" />
            ),
            cell: ({ row }) => {
                const lists = row.original.optionLists ?? [];
                if (lists.length === 0)
                    return (
                        <span className="text-muted-foreground text-[11px] italic">
                            No options
                        </span>
                    );

                return (
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <div className="flex items-center cursor-default py-1 group w-fit">
                                <Badge
                                    className="h-5 px-1.5 text-[11px] leading-none"
                                >
                                    {lists.length} {lists.length === 1 ? "Group" : "Groups"}
                                </Badge>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent
                            align="center"
                            className="px-3 py-2 text-xs"
                        >
                            <div className="space-y-1">
                                <p className="font-semibold text-[11px] text-muted uppercase tracking-wider">
                                    Option Groups
                                </p>
                                <ul className="list-disc pl-3 space-y-0">
                                    {lists.map((list) => (
                                        <li key={list.name} className="font-medium text-background">
                                            {list.name}
                                            <span className="ml-1 text-muted text-[10px] font-normal">
                                                ({list.options?.length ?? 0}{" "}
                                                {list.options?.length === 1 ? "option" : "options"})
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                );
            },
        },
        {
            accessorKey: "unitAmount",
            size: 90,
            minSize: 80,
            maxSize: 90,
            header: ({ column }) => (
                <div className="text-left">
                    <DataTableColumnHeader column={column} title="Price" className="-ml-3" />
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-left">
                    ${(Number(row.original.unitAmount) / 100).toFixed(2)}
                </div>
            ),
        },
        {
            accessorKey: "isActive",
            size: 90,
            minSize: 80,
            maxSize: 110,
            header: ({ column }) => (
                <div className="text-left">
                    <DataTableColumnHeader column={column} title="Status" className="-ml-3" />
                </div>
            ),
            cell: ({ row }) => {
                const product = row.original;
                const categoryInactive = !!product.category && !product.category.isActive;
                return (
                    <div className="text-left">
                        <StatusToggle
                            isActive={product.isActive}
                            categoryInactive={categoryInactive}
                            disabled={!canToggleStatus}
                            disabledReason={statusDisabledReason}
                            onToggle={(val) => onStatusToggle(product, val)}
                        />
                    </div>
                );
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right mr-6">Actions</div>,
            size: 90,
            minSize: 80,
            maxSize: 90,
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1 mr-3">
                    <div className="lg:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon-sm">
                                    <MoreHorizontal className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-30">
                                {canEdit ? (
                                    <DropdownMenuItem key="edit" onSelect={() => onEdit(row.original)}>
                                        <Pencil className="h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem disabled key="edit-disabled">
                                        <Pencil className="h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                )}
                                {canDelete ? (
                                    <DropdownMenuItem
                                        key="delete"
                                        onSelect={() => onDelete(row.original)}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" /> Delete
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem disabled key="delete-disabled">
                                        <Trash2 className="h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="hidden lg:flex items-center gap-1">
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        variant={"ghost"}
                                        size={"icon-sm"}
                                        onClick={() => onEdit(row.original)}
                                        disabled={!canEdit}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            {!canEdit && editDisabledReason ? (
                                <TooltipContent>{editDisabledReason}</TooltipContent>
                            ) : null}
                        </Tooltip>
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        variant={"ghost"}
                                        size={"icon-sm"}
                                        onClick={() => onDelete(row.original)}
                                        disabled={!canDelete}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            {!canDelete && deleteDisabledReason ? (
                                <TooltipContent>{deleteDisabledReason}</TooltipContent>
                            ) : null}
                        </Tooltip>
                    </div>
                </div>
            ),
        },
    ];
}
