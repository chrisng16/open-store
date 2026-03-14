import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { queryOptions, useQuery } from "@tanstack/react-query";

export type Store = {
    id: string;
    ownerId: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    themeConfig: Record<string, unknown> | null;
    stripeAccountId: string | null;
    stripeOnboardingComplete: boolean;
    isActive: boolean;
    address: string | null;
    phone: string | null;
    timezone: string;
    createdAt: string;
    updatedAt: string;
};

export type OnboardingStepStatus = {
    id: "store_details" | "stripe_connect" | "menu_setup";
    title: string;
    completed: boolean;
    required: boolean;
    blockingReasons: string[];
};

export type StoreOnboardingStatus = {
    storeId: string;
    onboardingComplete: boolean;
    canGoLive: boolean;
    isActive: boolean;
    completedRequiredSteps: number;
    totalRequiredSteps: number;
    nextStepId: OnboardingStepStatus["id"] | null;
    activeProductCount: number;
    hasPublishedImport: boolean;
    steps: OnboardingStepStatus[];
};

export const storesQueryOptions = queryOptions({
    queryKey: ["stores"],
    queryFn: () => fetchWithAccessToken<Store[]>("/stores"),
    staleTime: 30_000,
});

export function useStoresQuery() {
    return useQuery(storesQueryOptions);
}

export function useStoreOnboardingStatusQuery(storeId: string) {
    return useQuery({
        queryKey: ["store", storeId, "onboarding-status"],
        queryFn: () =>
            fetchWithAccessToken<StoreOnboardingStatus>(
                `/stores/${storeId}/onboarding-status`
            ),
        enabled: Boolean(storeId),
        staleTime: 10_000,
    });
}
