"use client";

import { ProductCategoryInput } from "@/components/dashboard/products/product-category-input";
import type { ProductCategoryOption } from "@/components/dashboard/products/product-editor-dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type BulkCategoryDialogProps = {
    open: boolean;
    selectedCount: number;
    categories: ProductCategoryOption[];
    value: { categoryName: string; categoryId: string };
    hasValue: boolean;
    isDisabled: boolean;
    onOpenChange: (open: boolean) => void;
    onChange: (next: { categoryName: string; categoryId: string }) => void;
    onCancel: () => void;
    onConfirm: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
};

export function BulkCategoryDialog({
    open,
    selectedCount,
    categories,
    value,
    hasValue,
    isDisabled,
    onOpenChange,
    onChange,
    onCancel,
    onConfirm,
    onKeyDown,
}: BulkCategoryDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onKeyDown={onKeyDown}>
                <DialogHeader>
                    <DialogTitle>Set category for selected items</DialogTitle>
                    <DialogDescription>
                        Choose an existing category or create a new one for {selectedCount} selected items.
                    </DialogDescription>
                </DialogHeader>
                <div className={isDisabled ? "pointer-events-none opacity-60" : undefined}>
                    <ProductCategoryInput
                        value={value.categoryName}
                        selectedCategoryId={value.categoryId}
                        categories={categories}
                        onChange={onChange}
                    />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isDisabled}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={onConfirm} disabled={isDisabled || !hasValue}>
                        Set category
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type PublishConfirmDialogProps = {
    open: boolean;
    hasDirtyChanges: boolean;
    isPending: boolean;
    onOpenChange: (open: boolean) => void;
    onCancel: () => void;
    onConfirm: () => void;
};

export function PublishConfirmDialog({
    open,
    hasDirtyChanges,
    isPending,
    onOpenChange,
    onCancel,
    onConfirm,
}: PublishConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Publish import to menu?</DialogTitle>
                    <DialogDescription>
                        Publishing is final. After this import is published, this review is locked and you cannot edit this import anymore.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={onConfirm} disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {hasDirtyChanges ? "Apply & Publish" : "Publish"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
