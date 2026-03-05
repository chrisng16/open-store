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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FormEvent } from "react";

export type CategoryFormData = {
    id?: string;
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
};

type CategoryEditorDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    formData: CategoryFormData;
    onFormDataChange: (value: CategoryFormData) => void;
    onSubmit: (e: FormEvent) => void;
    isSaving: boolean;
};

export function CategoryEditorDialog({
    open,
    onOpenChange,
    formData,
    onFormDataChange,
    onSubmit,
    isSaving,
}: CategoryEditorDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{formData.id ? "Edit Category" : "Create Category"}</DialogTitle>
                    <DialogDescription>
                        Set the label, visibility, and ordering used in your menu.
                    </DialogDescription>
                </DialogHeader>

                <form className="space-y-4" onSubmit={onSubmit}>
                    <div className="space-y-2">
                        <Label htmlFor="category-name">Name</Label>
                        <Input
                            id="category-name"
                            placeholder="Appetizers"
                            value={formData.name}
                            onChange={(e) =>
                                onFormDataChange({ ...formData, name: e.target.value })
                            }
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category-description">Description</Label>
                        <Textarea
                            id="category-description"
                            rows={3}
                            placeholder="Optional description shown in your dashboard"
                            value={formData.description}
                            onChange={(e) =>
                                onFormDataChange({ ...formData, description: e.target.value })
                            }
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="category-order">Sort Order</Label>
                            <Input
                                id="category-order"
                                type="number"
                                min={0}
                                value={formData.sortOrder}
                                onChange={(e) =>
                                    onFormDataChange({
                                        ...formData,
                                        sortOrder: Number.isNaN(Number(e.target.value))
                                            ? 0
                                            : Number(e.target.value),
                                    })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category-active">Visibility</Label>
                            <div className="flex h-10 items-center justify-between rounded-md border px-3">
                                <span className="text-sm text-muted-foreground">Active</span>
                                <Switch
                                    id="category-active"
                                    checked={formData.isActive}
                                    onCheckedChange={(checked) =>
                                        onFormDataChange({ ...formData, isActive: checked })
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? "Saving..." : formData.id ? "Save Changes" : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
