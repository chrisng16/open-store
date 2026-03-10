"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TeamRole } from "@/queries/team";
import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";

import { RoleEditorSheet } from "./role-editor-sheet";

type RoleDraft = {
    description: string;
    priority: number;
    permissions: string[];
};

type RolesTabProps = {
    roles: TeamRole[];
    actorPriority: number;
    drafts: Record<string, RoleDraft>;
    isSaving: boolean;
    onDraftChange: (roleId: string, patch: Partial<RoleDraft>) => void;
    onDiscard: () => void;
    onSave: () => void;
};

function permissionCount(role: TeamRole, draft: RoleDraft | undefined) {
    return (draft?.permissions ?? role.permissions).length;
}

export function RolesTab({
    roles,
    actorPriority,
    drafts,
    isSaving,
    onDraftChange,
    onDiscard,
    onSave,
}: RolesTabProps) {
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const [roleSheetOpen, setRoleSheetOpen] = useState(false);

    const editingRole = useMemo(
        () => (editingRoleId ? roles.find((role) => role.id === editingRoleId) ?? null : null),
        [editingRoleId, roles]
    );

    const isDirty = Object.keys(drafts).length > 0;

    return (
        <div className="space-y-6">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Role</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Permissions</TableHead>
                            <TableHead className="w-28">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {roles.map((role) => {
                            const draft = drafts[role.id];
                            const canEdit = role.priority < actorPriority && (role.isEditable || !role.isSystem);

                            return (
                                <TableRow key={role.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2 font-medium">
                                            {role.isSystem ? <Badge className="h-5 text-xs">System</Badge> : null}
                                            {role.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>{draft?.priority ?? role.priority}</TableCell>
                                    <TableCell>{draft?.description ?? role.description ?? "-"}</TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {permissionCount(role, draft)} permissions
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            onClick={() => {
                                                setEditingRoleId(role.id);
                                                setRoleSheetOpen(true);
                                            }}
                                            disabled={!canEdit}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {editingRole ? (
                <RoleEditorSheet
                    open={roleSheetOpen}
                    title={`Edit role: ${editingRole.name}`}
                    maxPriority={Math.max(0, actorPriority - 1)}
                    initialDraft={{
                        description: drafts[editingRole.id]?.description ?? editingRole.description ?? "",
                        priority: drafts[editingRole.id]?.priority ?? editingRole.priority,
                        permissions: drafts[editingRole.id]?.permissions ?? editingRole.permissions,
                    }}
                    onOpenChange={(open) => {
                        if (!open) {
                            setRoleSheetOpen(false);
                            setTimeout(() => {
                                setEditingRoleId(null);
                            }, 320);
                            return;
                        }
                        setRoleSheetOpen(true);
                    }}
                    onSave={(draft) => {
                        onDraftChange(editingRole.id, draft);
                    }}
                />
            ) : null}

            <div className="sticky bottom-0 z-20 flex justify-end gap-2 rounded-md border bg-background/95 p-3 backdrop-blur">
                <Button variant="outline" onClick={onDiscard} disabled={!isDirty || isSaving}>
                    Discard
                </Button>
                <Button onClick={onSave} disabled={!isDirty || isSaving}>
                    {isSaving ? "Saving..." : "Save changes"}
                </Button>
            </div>
        </div>
    );
}
