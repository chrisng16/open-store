"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TeamMember, TeamRole } from "@/queries/team";

type TeamMembersTabProps = {
    members: TeamMember[];
    roles: TeamRole[];
    currentUserId: string | null;
    actorPriority: number;
    drafts: Record<string, string>;
    isSaving: boolean;
    onRoleDraftChange: (memberId: string, roleId: string) => void;
    onSave: () => void;
    onDiscard: () => void;
};

function roleBadge(name: string) {
    if (name === "owner") return <Badge>Owner</Badge>;
    if (name === "admin") return <Badge variant="secondary">Admin</Badge>;
    if (name === "staff") return <Badge variant="outline">Staff</Badge>;
    return <Badge variant="outline">{name}</Badge>;
}

export function TeamMembersTab({
    members,
    roles,
    currentUserId,
    actorPriority,
    drafts,
    isSaving,
    onRoleDraftChange,
    onSave,
    onDiscard,
}: TeamMembersTabProps) {
    const isDirty = Object.keys(drafts).length > 0;

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Current Role</TableHead>
                            <TableHead>New Role</TableHead>
                            <TableHead>Joined</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((member) => {
                            const currentRoleId = roles.find((role) => role.name === member.roleName)?.id;
                            const selectedRoleId = drafts[member.id] ?? currentRoleId;
                            const canEdit = member.userId !== currentUserId && member.rolePriority < actorPriority;
                            const allowedRoles = roles.filter((role) => role.priority < actorPriority);

                            return (
                                <TableRow key={member.id}>
                                    <TableCell>
                                        <div className="font-medium">{member.name || "Unnamed user"}</div>
                                        <div className="text-xs text-muted-foreground">{member.email || "No email"}</div>
                                    </TableCell>
                                    <TableCell>{roleBadge(member.roleName)}</TableCell>
                                    <TableCell>
                                        {canEdit && selectedRoleId ? (
                                            <Select
                                                value={selectedRoleId}
                                                onValueChange={(value) => onRoleDraftChange(member.id, value)}
                                            >
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allowedRoles.map((role) => (
                                                        <SelectItem key={role.id} value={role.id}>
                                                            {role.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">No access</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{new Date(member.createdAt).toLocaleString()}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

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
