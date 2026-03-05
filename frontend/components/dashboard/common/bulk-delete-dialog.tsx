"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

type BulkDeleteDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemLabel: string;
    count: number;
    isDeleting: boolean;
    onConfirm: () => void;
};

function capitalizeFirstLetter(s: string) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BulkDeleteDialog({
    open,
    onOpenChange,
    itemLabel,
    count,
    isDeleting,
    onConfirm,
}: BulkDeleteDialogProps) {
    const endWithY = itemLabel[itemLabel.length - 1] === "y";
    const displayLabel = count === 1 ? itemLabel : endWithY ? `${itemLabel.slice(0, -1)}ies` : `${itemLabel}s`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Selected {capitalizeFirstLetter(displayLabel)}</DialogTitle>
                    <DialogDescription>
                        This action cannot be undone. You are about to delete {count} selected {displayLabel}.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isDeleting || count === 0}
                    >
                        {isDeleting ? "Deleting..." : `Delete`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
