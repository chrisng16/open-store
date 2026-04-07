"use client";

import { createClient } from "@/lib/supabase/client";
import { useTeamMembersQuery } from "@/queries/team";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const OWNER_ONLY_REASON = "Only store owners can perform this action.";

type CapabilityResult = {
    isLoading: boolean;
    isOwner: boolean;
    permissions: Set<string>;
    canAccessDashboard: boolean;
    canViewOrders: boolean;
    canViewAnalytics: boolean;
    canAccessPayments: boolean;
    canManageProducts: boolean;
    canManageProductPricing: boolean;
    canManageCategories: boolean;
    canDeleteProducts: boolean;
    canDeleteCategories: boolean;
    ownerOnlyReason: string;
};

export function useStoreCapabilities(storeId: string | undefined): CapabilityResult {
    const membersQuery = useTeamMembersQuery(storeId);
    const currentUserIdQuery = useQuery({
        queryKey: ["current-user-id"],
        queryFn: async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            return data.user?.id ?? null;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    return useMemo(() => {
        const myMember = membersQuery.data?.find(
            (member) => member.userId === currentUserIdQuery.data
        );
        const permissions = new Set(myMember?.permissions ?? []);
        const isOwner = myMember?.role === "owner";
        const canAccessDashboard = permissions.has("dashboard.access");

        return {
            isLoading: membersQuery.isPending || currentUserIdQuery.isPending,
            isOwner,
            permissions,
            canAccessDashboard,
            canViewOrders: canAccessDashboard && permissions.has("orders.read"),
            canViewAnalytics: canAccessDashboard && permissions.has("orders.read"),
            canAccessPayments: isOwner,
            canManageProducts: permissions.has("products.write"),
            canManageProductPricing: permissions.has("products.pricing.write"),
            canManageCategories: permissions.has("categories.write"),
            canDeleteProducts: isOwner,
            canDeleteCategories: isOwner,
            ownerOnlyReason: OWNER_ONLY_REASON,
        };
    }, [
        membersQuery.data,
        membersQuery.isPending,
        currentUserIdQuery.data,
        currentUserIdQuery.isPending,
    ]);
}
