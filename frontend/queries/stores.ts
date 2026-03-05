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

export const storesQueryOptions = queryOptions({
    queryKey: ["stores"],
    queryFn: () => fetchWithAccessToken<Store[]>("/stores"),
    staleTime: 30_000,
});

export function useStoresQuery() {
    return useQuery(storesQueryOptions);
}
