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

type ProductDeleteDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productName?: string;
    isDeleting: boolean;
    onConfirm: () => void;
};

export function ProductDeleteDialog({
    open,
    onOpenChange,
    productName,
    isDeleting,
    onConfirm,
}: ProductDeleteDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Product</DialogTitle>
                    <DialogDescription>
                        This action cannot be undone. Product:{" "}
                        <span className="font-medium text-foreground">{productName}</span>
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
