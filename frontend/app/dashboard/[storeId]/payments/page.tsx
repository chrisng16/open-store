"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { createClient } from "@/lib/supabase/client";
import { useTeamMembersQuery } from "@/queries/team";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";

type Store = {
    id: string;
    name: string;
    slug: string;
    stripeAccountId: string | null;
    stripeOnboardingComplete: boolean;
};

type StripeStatus = {
    connected: boolean;
    details_submitted: boolean;
    charges_enabled: boolean;
    payouts_enabled?: boolean;
    restricted?: boolean;
    requirements?: {
        currently_due?: string[];
        eventually_due?: string[];
        disabled_reason?: string | null;
    };
    capabilities?: {
        card_payments?: string | null;
        transfers?: string | null;
    };
};

export default function PaymentsPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const { storeId } = use(params);
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const stripeFlowState = searchParams.get("stripe");

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const membersQuery = useTeamMembersQuery(storeId);
    const { data: currentUserId, isPending: currentUserPending } = useQuery({
        queryKey: ["current-user-id"],
        queryFn: async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            return data.user?.id ?? null;
        },
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        notifyOnChangeProps: ["data", "isPending"],
    });

    const myMember = useMemo(() => {
        if (!currentUserId || !membersQuery.data) {
            return null;
        }
        return membersQuery.data.find((member) => member.userId === currentUserId) ?? null;
    }, [currentUserId, membersQuery.data]);

    const isOwner = myMember?.role === "owner";

    const {
        data: store,
        isPending: storePending,
        refetch: refetchStore,
    } = useQuery({
        queryKey: ["store", storeId],
        queryFn: async () => fetchWithAccessToken<Store>(`/stores/${storeId}`),
        enabled: !!storeId,
    });

    const {
        data: stripeStatus,
        isFetching: stripeStatusFetching,
        refetch: refetchStripeStatus,
    } = useQuery({
        queryKey: ["stripe-status", storeId],
        queryFn: async () => fetchWithAccessToken<StripeStatus>(`/stores/${storeId}/stripe/status`),
        enabled: !!storeId && isOwner,
        refetchInterval: (query) => {
            const status = query.state.data;
            if (!status) {
                return 5000;
            }
            return status.charges_enabled ? false : 5000;
        },
        refetchIntervalInBackground: true,
    });

    useEffect(() => {
        if (!isOwner) {
            return;
        }
        if (stripeFlowState === "complete" || stripeFlowState === "refresh") {
            void refetchStripeStatus();
            void refetchStore();

            // Keep Stripe return handling idempotent by clearing the query token after fetch.
            const timer = window.setTimeout(() => {
                router.replace(pathname);
            }, 1500);
            return () => window.clearTimeout(timer);
        }
    }, [isOwner, stripeFlowState, refetchStripeStatus, refetchStore, router, pathname]);

    const onboardMutation = useMutation({
        mutationFn: async () =>
            fetchWithAccessToken<{ url: string }>(`/stores/${storeId}/stripe/onboard`, {
                method: "POST",
            }),
        onSuccess: (data) => {
            window.location.href = data.url;
        },
        onError: (error) => {
            setErrorMessage(error instanceof Error ? error.message : "Failed to start Stripe onboarding");
        },
    });

    const loadingAccess = membersQuery.isPending || currentUserPending;
    const isInitialLoading = loadingAccess || storePending;
    const hasStripeAccount = !!store && (stripeStatus?.connected || !!store.stripeAccountId);
    const isConnected = !!store && (stripeStatus?.charges_enabled || store.stripeOnboardingComplete);
    const isRestricted = !!stripeStatus?.restricted;
    const currentlyDue = stripeStatus?.requirements?.currently_due ?? [];
    const disabledReason = stripeStatus?.requirements?.disabled_reason;

    return (
        <>
            <div className="sticky top-0 z-20 border-b bg-background-elevated/70 backdrop-blur rounded-t-md">
                <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6">
                    <div>
                        <h1 className="font-semibold">Payments</h1>
                        <p className="text-xs text-muted-foreground">
                            Manage Stripe Connect onboarding and payment capabilities.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isInitialLoading ? (
                            <Skeleton className="h-9 w-36" />
                        ) : (
                            <>
                                {!hasStripeAccount ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setErrorMessage(null);
                                            void refetchStripeStatus();
                                            void refetchStore();
                                        }}
                                        disabled={stripeStatusFetching}
                                    >
                                        {stripeStatusFetching ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                        )}
                                        Refresh Status
                                    </Button>
                                ) : null}

                                {hasStripeAccount ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            window.open("https://dashboard.stripe.com/", "_blank");
                                        }}
                                    >
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Manage Stripe Account
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                            setErrorMessage(null);
                                            onboardMutation.mutate();
                                        }}
                                        disabled={onboardMutation.isPending}
                                    >
                                        {onboardMutation.isPending ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                        )}
                                        Connect Stripe
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex h-full min-h-0 flex-col">
                <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 md:p-6">
                    {isInitialLoading ? <PaymentsContentSkeleton /> : null}

                    {!isInitialLoading && !store ? (
                        <Card>
                            <CardContent className="p-4 text-sm text-muted-foreground">Store not found.</CardContent>
                        </Card>
                    ) : null}

                    {!isInitialLoading && store && !isOwner ? (
                        <Card className="max-w-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldAlert className="h-5 w-5" />
                                    Payments Access Restricted
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Only store owners can manage Stripe Connect settings for this store.
                                </p>
                                <Link href={`/dashboard/${storeId}`}>
                                    <Button variant="outline">Back to Dashboard</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : null}

                    {!isInitialLoading && store && isOwner ? (
                        <>
                            {stripeFlowState === "complete" ? (
                                <Card className="border-emerald-500/40">
                                    <CardContent className="p-4 text-sm text-emerald-700 dark:text-emerald-400">
                                        Stripe onboarding returned successfully. Verifying account status now...
                                    </CardContent>
                                </Card>
                            ) : null}

                            {stripeFlowState === "refresh" ? (
                                <Card>
                                    <CardContent className="p-4 text-sm text-muted-foreground">
                                        Onboarding is not finished yet. Continue setup in Stripe to enable payments.
                                    </CardContent>
                                </Card>
                            ) : null}

                            {errorMessage ? (
                                <Card className="border-destructive/50">
                                    <CardContent className="p-4 text-sm text-destructive">{errorMessage}</CardContent>
                                </Card>
                            ) : null}

                            {isRestricted ? (
                                <Card className="border-amber-500/40">
                                    <CardContent className="space-y-2 p-4 text-sm text-amber-700 dark:text-amber-400">
                                        <p>Your Stripe account has pending requirements that may block payments.</p>
                                        {disabledReason ? <p>Reason: {disabledReason}</p> : null}
                                    </CardContent>
                                </Card>
                            ) : null}

                            <Card>
                                <CardHeader>
                                    <CardTitle>Stripe Connect Status</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={hasStripeAccount ? "default" : "secondary"}>
                                            {hasStripeAccount ? "Account Linked" : "Not Connected"}
                                        </Badge>
                                        <Badge variant={isConnected ? "default" : "secondary"}>
                                            {isConnected ? "Payments Enabled" : "Onboarding Required"}
                                        </Badge>
                                        <Badge variant={stripeStatus?.payouts_enabled ? "default" : "secondary"}>
                                            {stripeStatus?.payouts_enabled ? "Payouts Enabled" : "Payouts Pending"}
                                        </Badge>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm">Details Submitted</CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-sm text-muted-foreground">
                                                {stripeStatus?.details_submitted ? "Yes" : "No"}
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm">Charges</CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-sm text-muted-foreground">
                                                {stripeStatus?.charges_enabled ? "Enabled" : "Pending"}
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm">Payouts</CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-sm text-muted-foreground">
                                                {stripeStatus?.payouts_enabled ? "Enabled" : "Pending"}
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {currentlyDue.length > 0 ? (
                                        <div className="space-y-2 rounded-md border p-3">
                                            <p className="text-sm font-medium">Action Required In Stripe</p>
                                            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                                {currentlyDue.map((field) => (
                                                    <li key={field}>{field}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}

                                    {!isConnected ? (
                                        <p className="text-sm text-muted-foreground">
                                            Complete onboarding in Stripe to enable customer payments in your store.
                                            This page checks status every 5 seconds until setup is complete.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Stripe onboarding is complete. Your store can accept card payments.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    ) : null}
                </div>
            </div>
        </>
    );
}

function PaymentsContentSkeleton() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <Skeleton className="h-5 w-48" />
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-30" />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">
                                <Skeleton className="h-4 w-24" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-12" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">
                                <Skeleton className="h-4 w-16" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-20" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">
                                <Skeleton className="h-4 w-16" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-20" />
                        </CardContent>
                    </Card>
                </div>

                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
            </CardContent>
        </Card>
    );
}
