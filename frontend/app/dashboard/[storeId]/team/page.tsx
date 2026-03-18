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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import {
    applyMemberRoles,
    createInvite,
    createRole,
    revokeInvite,
    updateRole,
    useTeamInvitesQuery,
    useTeamMembersQuery,
    useTeamRolesQuery,
} from "@/queries/team";
import { useMutation } from "@tanstack/react-query";
import { Plus, UserPlus } from "lucide-react";
import { use, useEffect, useMemo, useState } from "react";

import { InvitesTab } from "./_components/invites-tab";
import { RoleEditorSheet } from "./_components/role-editor-sheet";
import { RolesTab } from "./_components/roles-tab";
import { TeamMembersTab } from "./_components/team-members-tab";
import TeamSubNav from "./_components/team-sub-nav";
import { UnsavedChangesDialog } from "./_components/unsaved-changes-dialog";

type TabValue = "members" | "roles" | "invites";
type InviteRole = "admin" | "staff";

type RoleDraft = {
    description: string;
    priority: number;
    permissions: string[];
};

type NewRoleDraft = {
    name: string;
    description: string;
    priority: number;
    permissions: string[];
};

const EMPTY_NEW_ROLE: NewRoleDraft = {
    name: "",
    description: "",
    priority: 10,
    permissions: [],
};

export default function TeamPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const { storeId } = use(params);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabValue>("members");
    const [pendingTab, setPendingTab] = useState<TabValue | null>(null);
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

    const [memberDrafts, setMemberDrafts] = useState<Record<string, string>>({});
    const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
    const [newRoleDraft, setNewRoleDraft] = useState<NewRoleDraft>(EMPTY_NEW_ROLE);

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<InviteRole>("admin");
    const [feedback, setFeedback] = useState<string | null>(null);

    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [memberDialogOpen, setMemberDialogOpen] = useState(false);
    const [createRoleSheetOpen, setCreateRoleSheetOpen] = useState(false);

    const [memberDialogMemberId, setMemberDialogMemberId] = useState<string>("");
    const [memberDialogRoleId, setMemberDialogRoleId] = useState<string>("");

    const membersQuery = useTeamMembersQuery(storeId);
    const rolesQuery = useTeamRolesQuery(storeId);
    const invitesQuery = useTeamInvitesQuery(storeId);

    useEffect(() => {
        const supabase = createClient();
        void supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data.user?.id ?? null);
        });
    }, []);

    const myMember = useMemo(() => {
        if (!currentUserId || !membersQuery.data) {
            return null;
        }
        return membersQuery.data.find((member) => member.userId === currentUserId) ?? null;
    }, [currentUserId, membersQuery.data]);

    const actorPriority = myMember?.rolePriority ?? 0;
    const actorPermissions = myMember?.permissions ?? [];
    const canManageInvites = actorPermissions.includes("team.invites.write");
    const canManageMembers = actorPermissions.includes("team.members.write");
    const canManageRoles = actorPermissions.includes("team.roles.write");

    const roleIdByName = useMemo(() => {
        const mapping: Record<string, string> = {};
        for (const role of rolesQuery.data ?? []) {
            mapping[role.name] = role.id;
        }
        return mapping;
    }, [rolesQuery.data]);

    const editableMembers = useMemo(
        () =>
            (membersQuery.data ?? []).filter(
                (member) => member.userId !== currentUserId && member.rolePriority < actorPriority
            ),
        [membersQuery.data, currentUserId, actorPriority]
    );

    const assignableRoles = useMemo(
        () => (rolesQuery.data ?? []).filter((role) => role.priority < actorPriority),
        [rolesQuery.data, actorPriority]
    );

    const isMembersDirty = Object.keys(memberDrafts).length > 0;
    const isRolesDirty =
        Object.keys(roleDrafts).length > 0 ||
        !!newRoleDraft.name.trim() ||
        newRoleDraft.permissions.length > 0 ||
        !!newRoleDraft.description.trim();
    const hasUnsavedChanges = isMembersDirty || isRolesDirty;

    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!hasUnsavedChanges) {
                return;
            }
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [hasUnsavedChanges]);

    const inviteMutation = useMutation({
        mutationFn: async () =>
            createInvite(storeId, {
                invitedEmail: inviteEmail,
                role: inviteRole,
            }),
        onSuccess: async (invite) => {
            setFeedback(`Invite created for ${invite.invitedEmail}`);
            setInviteEmail("");
            setInviteDialogOpen(false);
            await invitesQuery.refetch();
        },
        onError: (error) => {
            setFeedback(error instanceof Error ? error.message : "Failed to create invite");
        },
    });

    const revokeMutation = useMutation({
        mutationFn: async (inviteId: string) => revokeInvite(storeId, inviteId),
        onSuccess: async () => {
            await invitesQuery.refetch();
        },
        onError: (error) => {
            setFeedback(error instanceof Error ? error.message : "Failed to revoke invite");
        },
    });

    const saveMembersMutation = useMutation({
        mutationFn: async () => {
            const updates = Object.entries(memberDrafts).map(([memberId, roleId]) => ({ memberId, roleId }));
            return applyMemberRoles(storeId, { updates });
        },
        onSuccess: async () => {
            setMemberDrafts({});
            await Promise.all([membersQuery.refetch(), rolesQuery.refetch()]);
            setFeedback("Member role updates saved.");
        },
        onError: (error) => {
            setFeedback(error instanceof Error ? error.message : "Failed to save member role changes");
        },
    });

    const saveRolesMutation = useMutation({
        mutationFn: async () => {
            for (const [roleId, draft] of Object.entries(roleDrafts)) {
                await updateRole(storeId, roleId, {
                    description: draft.description,
                    priority: draft.priority,
                    permissions: draft.permissions,
                });
            }
            if (newRoleDraft.name.trim()) {
                await createRole(storeId, {
                    name: newRoleDraft.name,
                    description: newRoleDraft.description || undefined,
                    priority: newRoleDraft.priority,
                    permissions: newRoleDraft.permissions,
                });
            }
        },
        onSuccess: async () => {
            setRoleDrafts({});
            setNewRoleDraft(EMPTY_NEW_ROLE);
            await Promise.all([rolesQuery.refetch(), membersQuery.refetch()]);
            setFeedback("Role changes saved.");
        },
        onError: (error) => {
            setFeedback(error instanceof Error ? error.message : "Failed to save role changes");
        },
    });

    const isLoading = membersQuery.isPending || rolesQuery.isPending || invitesQuery.isPending;
    const pendingInvites = (invitesQuery.data ?? []).filter((invite) => invite.status === "pending");

    const discardCurrentTab = () => {
        if (activeTab === "members") {
            setMemberDrafts({});
        }
        if (activeTab === "roles") {
            setRoleDrafts({});
            setNewRoleDraft(EMPTY_NEW_ROLE);
        }
    };

    const handleTabChange = (nextTab: string) => {
        const target = nextTab as TabValue;
        if (target === activeTab) {
            return;
        }

        const currentTabDirty = (activeTab === "members" && isMembersDirty) || (activeTab === "roles" && isRolesDirty);
        if (currentTabDirty) {
            setPendingTab(target);
            setShowUnsavedDialog(true);
            return;
        }
        setActiveTab(target);
    };

    if (isLoading) {
        return (
            <div className="h-full flex flex-col flex-1">
                <TeamSubNav />
                <div className="px-4 md:px-6 flex-1 h-full">
                    {/* Tabs bar skeleton */}
                    <div className="sticky top-19 z-20 flex items-center justify-between border-b bg-background-elevated/80 py-2">
                        <Tabs>
                            <TabsList variant="line">
                                <TabsTrigger value="members">Team Members</TabsTrigger>
                                <TabsTrigger value="roles">Roles</TabsTrigger>
                                <TabsTrigger value="invites">Invites</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="flex gap-2 pr-2">
                            <Skeleton className="h-8 w-28 bg-accent" />
                        </div>
                    </div>
                    {/* Table skeleton */}
                    <div className="mt-4 rounded-md border">
                        <div className="grid grid-cols-4 gap-4 border-b px-4 py-3">
                            {["w-20", "w-24", "w-24", "w-16"].map((w, i) => (
                                <Skeleton key={i} className={`h-4 ${w}`} />
                            ))}
                        </div>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-4 gap-4 border-b px-4 py-4 last:border-0">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-8 w-36" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        ))}
                    </div>
                </div>
                {/* Action bar skeleton */}
                <div className="sticky inset-x-0 bottom-0 z-40 border-t bg-background-elevated/70 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-4xl items-center justify-end gap-2 p-4 py-3">
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-9 w-28" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="h-full flex flex-col flex-1">
                <TeamSubNav />
                <Tabs className="px-4 md:px-6 flex-1" value={activeTab} onValueChange={handleTabChange}>
                    <div className="sticky top-16 z-20 flex items-center justify-between border-b bg-background-elevated/80 py-2">
                        <TabsList variant="line">
                            <TabsTrigger value="members">Team Members</TabsTrigger>
                            <TabsTrigger value="roles">Roles</TabsTrigger>
                            <TabsTrigger value="invites">Invites</TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-2 pr-2">
                            {activeTab === "roles" && canManageRoles ? (
                                <Button className="rounded-full" variant="outline" size="sm" onClick={() => setCreateRoleSheetOpen(true)}>
                                    <Plus className="h-4 w-4" />
                                    Add role
                                </Button>
                            ) : null}
                            {canManageInvites ? (
                                <Button className="rounded-full" size="sm" onClick={() => setInviteDialogOpen(true)}>
                                    <UserPlus className="h-4 w-4" />
                                    Add member
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <TabsContent value="members" className="mt-4">
                        <TeamMembersTab
                            members={membersQuery.data ?? []}
                            roles={rolesQuery.data ?? []}
                            currentUserId={currentUserId}
                            actorPriority={actorPriority}
                            drafts={memberDrafts}
                            onRoleDraftChange={(memberId, roleId) => {
                                const member = (membersQuery.data ?? []).find((item) => item.id === memberId);
                                if (!member) {
                                    return;
                                }
                                const currentRoleId = roleIdByName[member.roleName];
                                setMemberDrafts((prev) => {
                                    const next = { ...prev };
                                    if (currentRoleId && roleId === currentRoleId) {
                                        delete next[memberId];
                                    } else {
                                        next[memberId] = roleId;
                                    }
                                    return next;
                                });
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="roles" className="mt-4">
                        <RolesTab
                            roles={rolesQuery.data ?? []}
                            actorPriority={actorPriority}
                            drafts={roleDrafts}
                            onDraftChange={(roleId, patch) => {
                                const role = (rolesQuery.data ?? []).find((item) => item.id === roleId);
                                if (!role) {
                                    return;
                                }
                                setRoleDrafts((prev) => {
                                    const nextDraft = {
                                        description: prev[roleId]?.description ?? role.description ?? "",
                                        priority: prev[roleId]?.priority ?? role.priority,
                                        permissions: prev[roleId]?.permissions ?? role.permissions,
                                        ...patch,
                                    };

                                    const unchanged =
                                        nextDraft.description === (role.description ?? "") &&
                                        nextDraft.priority === role.priority &&
                                        nextDraft.permissions.length === role.permissions.length &&
                                        nextDraft.permissions.every((permission) => role.permissions.includes(permission));

                                    const next = { ...prev };
                                    if (unchanged) {
                                        delete next[roleId];
                                    } else {
                                        next[roleId] = nextDraft;
                                    }
                                    return next;
                                });
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="invites" className="mt-4">
                        <InvitesTab
                            pendingInvites={pendingInvites}
                            canManageInvites={canManageInvites}
                            isRevoking={revokeMutation.isPending}
                            feedback={feedback}
                            onRevokeInvite={(inviteId) => revokeMutation.mutate(inviteId)}
                            onFeedback={setFeedback}
                        />
                    </TabsContent>
                </Tabs>

                {activeTab !== "invites" ? (
                    <div className="sticky inset-x-0 bottom-0 z-40 rounded-b-md border-t bg-background-elevated/70 backdrop-blur">
                        <div className="mx-auto flex w-full items-center justify-end gap-2 p-4 py-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={discardCurrentTab}
                                disabled={!hasUnsavedChanges || saveMembersMutation.isPending || saveRolesMutation.isPending}
                            >
                                Discard changes
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    if (activeTab === "members") saveMembersMutation.mutate();
                                    if (activeTab === "roles") saveRolesMutation.mutate();
                                }}
                                disabled={!hasUnsavedChanges || saveMembersMutation.isPending || saveRolesMutation.isPending}
                            >
                                {saveMembersMutation.isPending || saveRolesMutation.isPending ? "Saving..." : "Save changes"}
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>

            <UnsavedChangesDialog
                open={showUnsavedDialog}
                onCancel={() => {
                    setShowUnsavedDialog(false);
                    setPendingTab(null);
                }}
                onDiscard={() => {
                    discardCurrentTab();
                    if (pendingTab) {
                        setActiveTab(pendingTab);
                    }
                    setPendingTab(null);
                    setShowUnsavedDialog(false);
                }}
            />

            <RoleEditorSheet
                open={createRoleSheetOpen}
                title="Create custom role"
                description="Define role metadata and permissions."
                allowNameEdit
                maxPriority={Math.max(0, actorPriority - 1)}
                initialDraft={newRoleDraft}
                onOpenChange={setCreateRoleSheetOpen}
                onSave={(draft) => {
                    setNewRoleDraft({
                        name: (draft.name || "").trim(),
                        description: draft.description,
                        priority: draft.priority,
                        permissions: draft.permissions,
                    });
                    setActiveTab("roles");
                }}
            />

            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite Member</DialogTitle>
                        <DialogDescription>Send an invitation and set the initial role.</DialogDescription>
                    </DialogHeader>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            inviteMutation.mutate();
                        }}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="invite-dialog-email">Email</Label>
                            <Input
                                id="invite-dialog-email"
                                type="email"
                                required
                                value={inviteEmail}
                                onChange={(event) => setInviteEmail(event.target.value)}
                                placeholder="team@store.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="invite-dialog-role">Role</Label>
                            <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as InviteRole)}>
                                <SelectTrigger id="invite-dialog-role">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="staff">Staff</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={inviteMutation.isPending}>
                                {inviteMutation.isPending ? "Inviting..." : "Send invite"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Member Role</DialogTitle>
                        <DialogDescription>
                            Stage a role change for a member. It is enforced only after Save changes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Member</Label>
                            <Select value={memberDialogMemberId} onValueChange={setMemberDialogMemberId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select member" />
                                </SelectTrigger>
                                <SelectContent>
                                    {editableMembers.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                            {(member.name || member.email || "Member") + " (" + member.roleName + ")"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={memberDialogRoleId} onValueChange={setMemberDialogRoleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            {role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setMemberDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={!memberDialogMemberId || !memberDialogRoleId}
                            onClick={() => {
                                const member = (membersQuery.data ?? []).find((item) => item.id === memberDialogMemberId);
                                if (!member) {
                                    return;
                                }
                                const currentRoleId = roleIdByName[member.roleName];
                                setMemberDrafts((prev) => {
                                    const next = { ...prev };
                                    if (currentRoleId && memberDialogRoleId === currentRoleId) {
                                        delete next[memberDialogMemberId];
                                    } else {
                                        next[memberDialogMemberId] = memberDialogRoleId;
                                    }
                                    return next;
                                });
                                setMemberDialogOpen(false);
                                setActiveTab("members");
                            }}
                        >
                            Apply draft
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
