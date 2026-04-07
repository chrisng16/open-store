"use client";

import { NotAllowedState } from "@/components/dashboard/common/not-allowed-state";
import { useStoreCapabilities } from "@/hooks/use-store-capabilities";
import { use } from "react";

export default function StoreIdLayout({
    children,
    params,

}: {
    children: React.ReactNode;
    params: Promise<{ storeId: string }>;

}) {
    const { storeId } = use(params);
    const capabilities = useStoreCapabilities(storeId);

    if (!capabilities.isLoading && !capabilities.canAccessDashboard) {
        return (
            <NotAllowedState
                title="Dashboard access denied"
                message="Your role cannot access this dashboard. Contact the store owner to request access."
                returnHref="/dashboard"
            />
        );
    }

    return (
        <div className="relative h-full min-h-0">
            {children}
        </div>
    );
}
