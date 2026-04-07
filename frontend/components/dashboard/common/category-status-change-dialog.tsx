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
import { AlertCircle } from "lucide-react";

type CategoryStatusChangeDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categoryName?: string;
    isActive: boolean;
    isUpdating: boolean;
    onConfirm: () => void;
};

export function CategoryStatusChangeDialog({
    open,
    onOpenChange,
    categoryName,
    isActive,
    isUpdating,
    onConfirm,
}: CategoryStatusChangeDialogProps) {
    const action = isActive ? "show" : "hide";
    const actionLabel = isActive ? "Show" : "Hide";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change Category Status</DialogTitle>
                    <DialogDescription>
                        Review how this change will affect your store.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 items-start p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900 dark:text-amber-100">
                        <p className="font-medium mb-1">This will affect all products in this category.</p>
                        <p>All products in <span className="font-medium">{categoryName}</span> will be {action} from customers.</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant={!isActive ? "destructive" : "default"}
                        onClick={onConfirm}
                        disabled={isUpdating}
                    >
                        {isUpdating ? `${actionLabel}ing...` : `${actionLabel} Category`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
