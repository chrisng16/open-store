"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { useEffect, useState } from "react";

import { PermissionTree } from "./permission-tree";

type RoleDraft = {
    name?: string;
    description: string;
    priority: number;
    permissions: string[];
};

type RoleEditorSheetProps = {
    open: boolean;
    title: string;
    description?: string;
    allowNameEdit?: boolean;
    initialDraft: RoleDraft;
    maxPriority: number;
    onOpenChange: (open: boolean) => void;
    onSave: (draft: RoleDraft) => void;
};

export function RoleEditorSheet({
    open,
    title,
    description,
    allowNameEdit = false,
    initialDraft,
    maxPriority,
    onOpenChange,
    onSave,
}: RoleEditorSheetProps) {
    const [draft, setDraft] = useState<RoleDraft>(initialDraft);

    useEffect(() => {
        if (open) {
            setDraft(initialDraft);
        }
    }, [initialDraft, open]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl overflow-y-auto gap-0">
                <SheetHeader className="border-b">
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription>
                        {description ||
                            "Adjust role details and permissions."}
                    </SheetDescription>
                </SheetHeader>

                <div className="relative flex min-h-0 flex-1 w-full flex-col overflow-hidden">
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                        {allowNameEdit ? (
                            <div className="space-y-2">
                                <Label>Role Name</Label>
                                <Input
                                    value={draft.name || ""}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                                    placeholder="shift-lead"
                                />
                            </div>
                        ) : null}
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={draft.description}
                                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                                placeholder="Optional role description"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Priority (must be lower than your role)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={maxPriority}
                                value={draft.priority}
                                onChange={(event) =>
                                    setDraft((prev) => ({
                                        ...prev,
                                        priority: Math.max(0, Math.min(maxPriority, Number(event.target.value) || 0)),
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Permissions</Label>
                            <PermissionTree
                                selected={draft.permissions}
                                onChange={(permissions) => setDraft((prev) => ({ ...prev, permissions }))}
                            />
                        </div>
                    </div>
                </div>

                <SheetFooter className="border-t flex-row p-4 justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            onSave(draft);
                            onOpenChange(false);
                        }}
                    >
                        Apply draft
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
