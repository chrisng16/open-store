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

type CategoryDeleteDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categoryName?: string;
    isDeleting: boolean;
    onConfirm: () => void;
};

export function CategoryDeleteDialog({
    open,
    onOpenChange,
    categoryName,
    isDeleting,
    onConfirm,
}: CategoryDeleteDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Category</DialogTitle>
                    <DialogDescription>
                        This action cannot be undone. Category:{" "}
                        <span className="font-medium text-foreground">{categoryName}</span>
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
                        disabled={isDeleting}
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
