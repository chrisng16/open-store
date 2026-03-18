"use client";

import { DataTableColumnHeader } from "@/components/dashboard/common/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export type ProductCategoryOption = {
    id: string;
    name: string;
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
};

export function getProductsTableColumns({
    onEdit,
    onDelete,
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
                <div className="text-left">${(Number(row.original.unitAmount) / 100).toFixed(2)}</div>
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
            cell: ({ row }) => (
                <div className="text-left">
                    <Badge
                        variant={row.original.isActive ? "default" : "secondary"}
                        className="h-5 px-1.5 text-[11px] leading-none"
                    >
                        {row.original.isActive ? "Active" : "Hidden"}
                    </Badge>
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            size: 90,
            minSize: 80,
            maxSize: 90,
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <div className="lg:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon-sm">
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
                    <div className="hidden lg:flex items-center gap-1">
                        <Button
                            variant={'ghost'}
                            size={'icon-sm'}
                            onClick={() => onEdit(row.original)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={'ghost'}
                            size={'icon-sm'}
                            onClick={() => onDelete(row.original)}
                            className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            ),
        },
    ];
}
