"use client";

import { NotAllowedState } from "@/components/dashboard/common/not-allowed-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreCapabilities } from "@/hooks/use-store-capabilities";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { createClient } from "@/lib/supabase/client";
import { useTeamMembersQuery } from "@/queries/team";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Banknote, CheckCircle2, CreditCard, ExternalLink, Globe, Landmark, Loader2, MapPin, RefreshCw, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
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
    tax_settings?: {
        status: string;
        headquarters: boolean;
        defaults: boolean;
    };
};

export default function PaymentsPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const { storeId } = use(params);
    const capabilities = useStoreCapabilities(storeId);
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

    const canAccessPayments = capabilities.canAccessPayments;

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
        enabled: !!storeId && canAccessPayments,
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
        if (!canAccessPayments) {
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
    }, [canAccessPayments, stripeFlowState, refetchStripeStatus, refetchStore, router, pathname]);

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

    const loadingAccess = membersQuery.isPending || currentUserPending || capabilities.isLoading;
    const isInitialLoading = loadingAccess || storePending;
    const hasStripeAccount = !!store && (stripeStatus?.connected || !!store.stripeAccountId);
    const isConnected = !!store && (stripeStatus?.charges_enabled || store.stripeOnboardingComplete);
    const isRestricted = !!stripeStatus?.restricted;
    const currentlyDue = stripeStatus?.requirements?.currently_due ?? [];
    const disabledReason = stripeStatus?.requirements?.disabled_reason;

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Payments & Tax</h1>
                        <p className="text-muted-foreground text-sm">
                            Configure how your store accepts payments and handles tax collection.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isInitialLoading ? (
                            <Skeleton className="h-10 w-36" />
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setErrorMessage(null);
                                        void refetchStripeStatus();
                                        void refetchStore();
                                    }}
                                    disabled={stripeStatusFetching || !canAccessPayments}
                                >
                                    {stripeStatusFetching ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                    )}
                                    Sync
                                </Button>
                                {hasStripeAccount && canAccessPayments && (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            window.open("https://dashboard.stripe.com/", "_blank");
                                        }}
                                    >
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Stripe Dashboard
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="mx-auto w-full max-w-7xl space-y-8">
                    {isInitialLoading ? <PaymentsContentSkeleton /> : null}

                    {!isInitialLoading && store && !canAccessPayments ? (
                        <NotAllowedState
                            title="Payments access denied"
                            message="Only store owners can manage payment and tax settings."
                            returnHref={`/dashboard/${storeId}`}
                        />
                    ) : null}

                    {!isInitialLoading && store && canAccessPayments ? (
                        <div className="grid gap-8 lg:grid-cols-12">
                            {/* Status Overview Grid */}
                            <div className="lg:col-span-12 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                                <StatusCard
                                    title="Account"
                                    status={hasStripeAccount ? "Linked" : "Not Linked"}
                                    icon={<Landmark className="h-4 w-4" />}
                                    variant={hasStripeAccount ? "success" : "warning"}
                                />
                                <StatusCard
                                    title="Payments"
                                    status={isConnected ? "Enabled" : "Disabled"}
                                    icon={<CreditCard className="h-4 w-4" />}
                                    variant={isConnected ? "success" : "warning"}
                                />
                                <StatusCard
                                    title="Payouts"
                                    status={stripeStatus?.payouts_enabled ? "Enabled" : "Pending"}
                                    icon={<Banknote className="h-4 w-4" />}
                                    variant={stripeStatus?.payouts_enabled ? "success" : "warning"}
                                />
                                <StatusCard
                                    title="Tax Service"
                                    status={stripeStatus?.tax_settings?.status === "active" ? "Active" : "Not Ready"}
                                    icon={<Globe className="h-4 w-4" />}
                                    variant={stripeStatus?.tax_settings?.status === "active" ? "success" : "warning"}
                                />
                            </div>

                            {/* Main Configuration Content */}
                            <div className="lg:col-span-8 space-y-6">
                                {stripeFlowState === "complete" && (
                                    <Card className="border-emerald-500/40 bg-emerald-500/5 animate-in fade-in slide-in-from-top-2 duration-500">
                                        <CardContent className="p-4 flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                                            <CheckCircle2 className="h-5 w-5" />
                                            <span className="text-sm font-medium">Onboarding returned. Refreshing account status...</span>
                                        </CardContent>
                                    </Card>
                                )}

                                {errorMessage && (
                                    <Card className="border-destructive/50 bg-destructive/5">
                                        <CardContent className="p-4 flex items-center gap-3 text-destructive">
                                            <AlertCircle className="h-5 w-5" />
                                            <span className="text-sm font-medium">{errorMessage}</span>
                                        </CardContent>
                                    </Card>
                                )}

                                {isRestricted && (
                                    <Card className="border-amber-500/50 bg-amber-500/5">
                                        <CardContent className="p-4 flex items-start gap-3 text-amber-700">
                                            <ShieldAlert className="h-5 w-5 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-sm text-amber-800">Action required from Stripe</p>
                                                <p className="text-xs mt-1 leading-relaxed">{disabledReason || "Your account has pending requirements that may block payments."}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Stripe Connect Section */}
                                <Card className="shadow-sm border-border/60 overflow-hidden">
                                    <CardHeader className="flex flex-row items-center justify-between bg-muted/20 pb-4">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                                <Landmark className="h-5 w-5 text-primary" />
                                                Payment Processing
                                            </CardTitle>
                                            <CardDescription>
                                                Manage your Stripe Connect account and card acceptance.
                                            </CardDescription>
                                        </div>
                                        {isConnected ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-2.5 py-0.5">
                                                Live
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">
                                                Setup Needed
                                            </Badge>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <InfoBox
                                                title="Identity Verification"
                                                active={!!stripeStatus?.details_submitted}
                                                description={stripeStatus?.details_submitted
                                                    ? "Business details verified."
                                                    : "Details submission required."}
                                                icon={<ShieldCheck className="h-4 w-4" />}
                                            />
                                            <InfoBox
                                                title="Card Capability"
                                                active={stripeStatus?.capabilities?.card_payments === "active"}
                                                description={stripeStatus?.capabilities?.card_payments === "active"
                                                    ? "Active and ready."
                                                    : "Capability is pending."}
                                                icon={<Wallet className="h-4 w-4" />}
                                            />
                                        </div>

                                        {currentlyDue.length > 0 && (
                                            <div className="p-4 rounded-lg border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 border shadow-inner">
                                                <p className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Information Requested
                                                </p>
                                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                                    {currentlyDue.map((field) => (
                                                        <li key={field} className="text-[11px] text-amber-700/80 flex items-center gap-2 capitalize">
                                                            <div className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                                                            {field.replace(/_/g, " ")}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {!hasStripeAccount && (
                                            <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-border/60 rounded-xl space-y-4 bg-muted/10">
                                                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                                                    <Landmark className="h-8 w-8 text-primary" />
                                                </div>
                                                <div className="text-center max-w-sm">
                                                    <p className="font-bold text-lg">Connect Stripe Account</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        You need to link a Stripe account to start receiving money from your customers.
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={() => onboardMutation.mutate()}
                                                    disabled={onboardMutation.isPending}
                                                    className="px-8 font-semibold transition-all hover:scale-105"
                                                >
                                                    {onboardMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                                                    Start Connection
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Tax Settings Section */}
                                <Card className="shadow-sm border-border/60 overflow-hidden">
                                    <CardHeader className="flex flex-row items-center justify-between bg-muted/20 pb-4">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                                <Globe className="h-5 w-5 text-primary" />
                                                Tax Collection
                                            </CardTitle>
                                            <CardDescription>
                                                Automate sales tax calculation for your customers.
                                            </CardDescription>
                                        </div>
                                        {stripeStatus?.tax_settings?.status === "active" ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-2.5 py-0.5">
                                                Active
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">
                                                Inactive
                                            </Badge>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <InfoBox
                                                title="Business Headquarters"
                                                active={!!stripeStatus?.tax_settings?.headquarters}
                                                description={stripeStatus?.tax_settings?.headquarters
                                                    ? "Headquarters address set."
                                                    : "Origin address missing."}
                                                icon={<MapPin className="h-4 w-4" />}
                                            />
                                            <InfoBox
                                                title="Tax Registrations"
                                                active={stripeStatus?.tax_settings?.status === "active"}
                                                description={stripeStatus?.tax_settings?.status === "active"
                                                    ? "Ready to collect tax."
                                                    : "No active registrations."}
                                                icon={<CheckCircle2 className="h-4 w-4" />}
                                            />
                                        </div>

                                        {stripeStatus?.tax_settings?.status !== "active" && (
                                            <div className="p-4 rounded-xl border-blue-200/60 bg-blue-50/50 dark:bg-blue-900/5 border text-blue-700 dark:text-blue-400">
                                                <p className="text-sm font-bold flex items-center gap-2 mb-1.5">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Setup Required
                                                </p>
                                                <p className="text-xs leading-relaxed opacity-90">
                                                    To enable automatic tax calculation, you must register
                                                    for tax in your Stripe Dashboard and configure your business headquarters address.
                                                </p>
                                                <Button
                                                    variant="link"
                                                    className="p-0 h-auto text-xs font-bold text-blue-600 mt-2 hover:no-underline"
                                                    onClick={() => window.open("https://dashboard.stripe.com/tax", "_blank")}
                                                >
                                                    Go to Stripe Tax Setup <ExternalLink className="ml-1 h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Sidebar Helpful Info */}
                            <div className="lg:col-span-4 space-y-6">
                                <Card className="bg-primary/5 border-primary/10 shadow-none">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-primary" />
                                            Payment Info
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-xs space-y-4 text-muted-foreground leading-relaxed">
                                        <p>Funds from sales are processed securely through Stripe Connect and transferred to your bank account on a rolling basis.</p>
                                        <Separator className="bg-primary/10" />
                                        <div className="flex items-center gap-2 text-primary font-semibold italic">
                                            <ShieldCheck className="h-4 w-4" />
                                            PCI-DSS Compliant
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-muted/20 border-none shadow-inner">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">Technical Reference</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-[10px] space-y-3 font-mono">
                                        <div className="space-y-1">
                                            <span className="text-muted-foreground block uppercase text-[9px]">Store UUID</span>
                                            <span className="text-foreground font-bold break-all bg-background/50 p-1 rounded border border-border/40 block">{storeId}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-muted-foreground block uppercase text-[9px]">Stripe Account ID</span>
                                            <span className="text-foreground font-bold break-all bg-background/50 p-1 rounded border border-border/40 block">{store?.stripeAccountId || "Not Assigned"}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function StatusCard({ title, status, icon, variant }: { title: string, status: string, icon: React.ReactNode, variant: "success" | "warning" }) {
    return (
        <Card className="border-none shadow-sm ring-1 ring-border/60 bg-card hover:ring-primary/30 transition-all duration-300">
            <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground/70 mb-1.5">
                    <div className="p-1 rounded bg-muted/50">{icon}</div>
                    <span className="text-[10px] uppercase tracking-widest font-bold">{title}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${variant === "success" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"}`} />
                    <span className="text-sm font-black tracking-tight">{status}</span>
                </div>
            </CardContent>
        </Card>
    );
}

function InfoBox({ title, active, description, icon }: { title: string, active: boolean, description: string, icon: React.ReactNode }) {
    return (
        <div className="p-4 rounded-xl border border-border/50 bg-muted/20 flex items-start gap-3 hover:bg-muted/30 transition-colors">
            <div className={`p-2 rounded-lg mt-0.5 ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{description}</p>
            </div>
        </div>
    );
}

function PaymentsContentSkeleton() {
    return (
        <div className="space-y-8 max-w-7xl mx-auto w-full">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-border/60">
                        <CardContent className="p-4 space-y-2">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-5 w-24" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-6">
                    <Card><CardContent className="p-20"><Skeleton className="h-40 w-full" /></CardContent></Card>
                    <Card><CardContent className="p-20"><Skeleton className="h-40 w-full" /></CardContent></Card>
                </div>
                <div className="lg:col-span-4 space-y-6">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        </div>
    );
}
