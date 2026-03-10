"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef } from "@tanstack/react-table";
import { Check, Pencil, X } from "lucide-react";
import type { ImportItem } from "./types";
import { confidenceColor } from "./utils";

type CreateImportReviewColumnsParams = {
    isPublished: boolean;
    dirtyItemIdSet: Set<string>;
    isActionPending: boolean;
    onEdit: (item: ImportItem) => void;
    onApprove: (itemId: string) => void;
    onReject: (itemId: string) => void;
};

export function createImportReviewColumns({
    isPublished,
    dirtyItemIdSet,
    isActionPending,
    onEdit,
    onApprove,
    onReject,
}: CreateImportReviewColumnsParams): ColumnDef<ImportItem>[] {
    return [
        {
            accessorKey: "itemName",
            header: "Name",
            cell: ({ row }) => <span className=" text-foreground">{row.original.itemName || "—"}</span>,
        },
        {
            accessorKey: "categoryName",
            header: "Category",
            cell: ({ row }) => <span className=" text-foreground">{row.original.categoryName || "—"}</span>,
        },
        {
            accessorKey: "unitAmount",
            header: "Price",
            cell: ({ row }) => (
                <span className=" text-foreground">
                    {row.original.unitAmount != null ? `$${(Number(row.original.unitAmount) / 100).toFixed(2)}` : "—"}
                </span>
            ),
        },
        {
            accessorKey: "confidence",
            header: "Confidence",
            cell: ({ row }) => (
                <span className={` font-medium ${confidenceColor(row.original.confidence)}`}>
                    {row.original.confidence != null ? `${Math.round(row.original.confidence * 100)}%` : "—"}
                </span>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const currentStatus = row.original.status;
                const isDirty = dirtyItemIdSet.has(row.original.id);

                return (
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={
                                currentStatus === "approved"
                                    ? "default"
                                    : currentStatus === "rejected"
                                        ? "destructive"
                                        : "outline"
                            }
                        >
                            {currentStatus.replace("_", " ")}
                        </Badge>
                        {isDirty ? (
                            <Badge variant="outline" className="text-xs">
                                Unsaved
                            </Badge>
                        ) : null}
                    </div>
                );
            },
        },
        {
            id: "modifiers",
            header: "Options",
            cell: ({ row }) => (
                <div className="text-xs text-muted-foreground max-w-60">
                    {row.original.optionLists?.optionLists && row.original.optionLists.optionLists.length > 0 ? (
                        row.original.optionLists.optionLists.map((group, idx) => (
                            <div key={`${group.name}-${idx}`} className="truncate">
                                <span className="font-medium text-foreground">{group.name}</span>
                                {group.options && group.options.length > 0 ? (
                                    <span>
                                        {": "}
                                        {group.options
                                            .map((option) => {
                                                const adj = option.unitAmount ?? 0;
                                                const suffix =
                                                    adj > 0
                                                        ? ` (+$${(adj / 100).toFixed(2)})`
                                                        : adj < 0
                                                            ? ` (-$${(Math.abs(adj) / 100).toFixed(2)})`
                                                            : "";
                                                return `${option.name}${suffix}${option.isDefault ? " [default]" : ""}`;
                                            })
                                            .join(", ")}
                                    </span>
                                ) : (
                                    <span>: None</span>
                                )}
                            </div>
                        ))
                    ) : (
                        <span>—</span>
                    )}
                </div>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(row.original)}
                        disabled={isPublished || isActionPending}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-600"
                        onClick={() => onApprove(row.original.id)}
                        disabled={isPublished || isActionPending}
                    >
                        <Check className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600"
                        onClick={() => onReject(row.original.id)}
                        disabled={isPublished || isActionPending}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];
}
