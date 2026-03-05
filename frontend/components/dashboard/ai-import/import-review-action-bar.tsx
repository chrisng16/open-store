"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, Check, ChevronDownIcon, X } from "lucide-react";
import type { StatusFilter } from "./types";

type ImportReviewActionBarProps = {
    statusFilter: StatusFilter;
    dirtyCounts: { pending: number; accepted: number; rejected: number };
    isPublished: boolean;
    selectedCount: number;
    isActionPending: boolean;
    onStatusFilterChange: (value: StatusFilter) => void;
    onOpenBulkCategoryDialog: () => void;
    onBulkApprove: () => void;
    onBulkReject: () => void;
};

export function ImportReviewActionBar({
    statusFilter,
    dirtyCounts,
    isPublished,
    selectedCount,
    isActionPending,
    onStatusFilterChange,
    onOpenBulkCategoryDialog,
    onBulkApprove,
    onBulkReject,
}: ImportReviewActionBarProps) {
    const isBulkDisabled = isPublished || selectedCount === 0 || isActionPending;

    return (
        <>
            <Tabs className="mb-0" value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}>
                <TabsList>
                    <TabsTrigger value="pending">
                        Pending
                        <Badge variant="outline" className="ml-1 h-5 text-[0.65rem]">
                            {dirtyCounts.pending} changes
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="accepted">
                        Accepted
                        <Badge variant="outline" className="ml-1 h-5 text-[0.65rem]">
                            {dirtyCounts.accepted} changes
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="rejected">
                        Rejected
                        <Badge variant="outline" className="ml-1 h-5 text-[0.65rem]">
                            {dirtyCounts.rejected} changes
                        </Badge>
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2">
                <ButtonGroup>
                    <Button variant="outline" className="pointer-events-none" tabIndex={-1} size="sm">
                        Bulk Actions
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            {
                                <Button variant="outline" size="sm" className="pl-2!" disabled={isPublished}>
                                    <ChevronDownIcon />
                                </Button>
                            }
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuGroup>
                                <DropdownMenuItem onClick={onOpenBulkCategoryDialog} disabled={isBulkDisabled}>
                                    <Boxes />
                                    Set Category
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onBulkApprove} disabled={isBulkDisabled}>
                                    <Check />
                                    Mark as Accepted
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onBulkReject} disabled={isBulkDisabled}>
                                    <X />
                                    Mark as Rejected
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </ButtonGroup>
            </div>
        </>
    );
}
