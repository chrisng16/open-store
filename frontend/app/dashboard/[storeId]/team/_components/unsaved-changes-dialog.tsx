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

type UnsavedChangesDialogProps = {
    open: boolean;
    onCancel: () => void;
    onDiscard: () => void;
};

export function UnsavedChangesDialog({ open, onCancel, onDiscard }: UnsavedChangesDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(value) => (!value ? onCancel() : undefined)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Unsaved changes</DialogTitle>
                    <DialogDescription>
                        You have unsaved security-sensitive changes. Discard them before navigating away?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={onDiscard}>
                        Discard changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
