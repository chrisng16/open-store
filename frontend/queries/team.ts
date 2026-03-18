import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";
import { queryOptions, useQuery } from "@tanstack/react-query";

export type TeamMember = {
    id: string;
    storeId: string;
    userId: string;
    name: string | null;
    email: string | null;
    role: "owner" | "admin" | "staff";
    roleName: string;
    rolePriority: number;
    permissions: string[];
    createdAt: string;
    updatedAt: string;
};

export type TeamRole = {
    id: string;
    storeId: string;
    name: string;
    description: string | null;
    priority: number;
    permissions: string[];
    isSystem: boolean;
    isEditable: boolean;
    createdAt: string;
    updatedAt: string;
};

export type TeamInvite = {
    id: string;
    storeId: string;
    invitedByUserId: string;
    invitedEmail: string;
    role: "owner" | "admin" | "staff";
    status: "pending" | "accepted" | "revoked" | "expired";
    token: string;
    inviteLink: string;
    expiresAt: string;
    acceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type InvitePayload = {
    invitedEmail: string;
    role: "admin" | "staff";
};

export type CreateRolePayload = {
    name: string;
    description?: string;
    priority: number;
    permissions: string[];
};

export type UpdateRolePayload = {
    description?: string;
    priority?: number;
    permissions?: string[];
};

export type ApplyMemberRolesPayload = {
    updates: { memberId: string; roleId: string }[];
};

export const teamMembersQueryOptions = (storeId: string | undefined) =>
    queryOptions({
        queryKey: ["team-members", storeId],
        queryFn: () => fetchWithAccessToken<TeamMember[]>(`/stores/${storeId}/members`),
        enabled: !!storeId,
    });

export const teamInvitesQueryOptions = (storeId: string | undefined) =>
    queryOptions({
        queryKey: ["team-invites", storeId],
        queryFn: () => fetchWithAccessToken<TeamInvite[]>(`/stores/${storeId}/invites`),
        enabled: !!storeId,
    });

export const teamRolesQueryOptions = (storeId: string | undefined) =>
    queryOptions({
        queryKey: ["team-roles", storeId],
        queryFn: () => fetchWithAccessToken<TeamRole[]>(`/stores/${storeId}/roles`),
        enabled: !!storeId,
    });

export function useTeamMembersQuery(storeId: string | undefined) {
    return useQuery(teamMembersQueryOptions(storeId));
}

export function useTeamInvitesQuery(storeId: string | undefined) {
    return useQuery(teamInvitesQueryOptions(storeId));
}

export function useTeamRolesQuery(storeId: string | undefined) {
    return useQuery(teamRolesQueryOptions(storeId));
}

export async function createInvite(storeId: string | undefined, payload: InvitePayload) {
    return fetchWithAccessToken<TeamInvite>(`/stores/${storeId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(denormalizeRequest(payload)),
    });
}

export async function revokeInvite(storeId: string | undefined, inviteId: string) {
    return fetchWithAccessToken<void>(`/stores/${storeId}/invites/${inviteId}`, {
        method: "DELETE",
    });
}

export async function createRole(storeId: string | undefined, payload: CreateRolePayload) {
    return fetchWithAccessToken<TeamRole>(`/stores/${storeId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(denormalizeRequest(payload)),
    });
}

export async function updateRole(storeId: string | undefined, roleId: string, payload: UpdateRolePayload) {
    return fetchWithAccessToken<TeamRole>(`/stores/${storeId}/roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(denormalizeRequest(payload)),
    });
}

export async function deleteRole(storeId: string | undefined, roleId: string) {
    return fetchWithAccessToken<void>(`/stores/${storeId}/roles/${roleId}`, {
        method: "DELETE",
    });
}

export async function applyMemberRoles(storeId: string | undefined, payload: ApplyMemberRolesPayload) {
    return fetchWithAccessToken<{ appliedCount: number }>(`/stores/${storeId}/members/roles/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(denormalizeRequest(payload)),
    });
}

export async function acceptInvite(token: string) {
    return fetchWithAccessToken<{ storeId: string; role: "owner" | "admin" | "staff"; status: string }>(
        `/team/invites/accept/${token}`,
        {
            method: "POST",
        }
    );
}
