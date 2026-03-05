"use client";

import { DataTableColumnHeader } from "@/components/dashboard/common/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

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

type CategoryColumnsParams = {
    onEdit: (category: CategoryRow) => void;
    onDelete: (category: CategoryRow) => void;
};

export function getCategoriesTableColumns({
    onEdit,
    onDelete,
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
                <div className="text-center">
                    <DataTableColumnHeader column={column} title="Status" className="-ml-3" />
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-center">
                    <Badge variant={row.original.isActive ? "default" : "secondary"}>
                        {row.original.isActive ? "Active" : "Hidden"}
                    </Badge>
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
