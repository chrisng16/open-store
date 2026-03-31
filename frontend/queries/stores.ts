import { fetchWithAccessToken } from "@/lib/auth-fetch";
export type { Store, StoreOnboardingStatus } from "@/lib/types";
import type { Store, StoreOnboardingStatus } from "@/lib/types";
import { queryOptions, useQuery } from "@tanstack/react-query";

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
