"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { use, useEffect, useState } from "react";

type StoreSettings = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    isActive: boolean;
    taxRate: number;
    stripeAccountId: string | null;
    stripeOnboardingComplete: boolean;
    themeConfig: { primaryColor?: string; accentColor?: string } | null;
};

export default function SettingsPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const { storeId } = use(params);
    const [message, setMessage] = useState<string | null>(null);

    // Form fields
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [taxRate, setTaxRate] = useState("");
    const [primaryColor, setPrimaryColor] = useState("#2563eb");
    const [accentColor, setAccentColor] = useState("#f59e0b");

    const { data: store, isPending, refetch } = useQuery({
        queryKey: ["store-settings", storeId],
        queryFn: async () =>
            fetchWithAccessToken<StoreSettings>(`/stores/${storeId}`),
        enabled: !!storeId,
    });

    useEffect(() => {
        if (!store) return;
        setName(store.name);
        setDescription(store.description || "");
        setTaxRate(String(store.taxRate ?? "0.08"));
        setPrimaryColor(store.themeConfig?.primaryColor || "#2563eb");
        setAccentColor(store.themeConfig?.accentColor || "#f59e0b");
    }, [store]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            return fetchWithAccessToken<StoreSettings>(`/stores/${storeId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    denormalizeRequest({
                        name,
                        description: description || null,
                        taxRate: parseFloat(taxRate),
                        themeConfig: { primaryColor, accentColor },
                    })
                ),
            });
        },
        onSuccess: () => {
            setMessage("Settings saved!");
            void refetch();
        },
        onError: () => {
            setMessage("Failed to save settings");
        },
    });

    const stripeConnectMutation = useMutation({
        mutationFn: async () => {
            return fetchWithAccessToken<{ url: string }>(
                `/payments/stores/${storeId}/stripe/onboard`,
                {
                    method: "POST",
                }
            );
        },
        onSuccess: (data) => {
            window.location.href = data.url;
        },
    });

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!storeId) return;
        setMessage(null);
        await saveMutation.mutateAsync();
    }

    async function handleStripeConnect() {
        if (!storeId) return;
        await stripeConnectMutation.mutateAsync();
    }

    if (isPending)
        return <div className="p-6 text-muted-foreground">Loading settings...</div>;

    return (
        <div className="mx-auto max-w-2xl p-6">
            <h1 className="mb-6 text-2xl font-bold">Store Settings</h1>

            <form onSubmit={handleSave} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>General</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="store-name">Store Name</Label>
                            <Input
                                id="store-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="store-desc">Description</Label>
                            <Textarea
                                id="store-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tax-rate">Tax Rate</Label>
                            <Input
                                id="tax-rate"
                                type="number"
                                step="0.001"
                                min="0"
                                max="1"
                                value={taxRate}
                                onChange={(e) => setTaxRate(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter as decimal (e.g. 0.08 for 8%)
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Theme</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="primary-color">Primary Color</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="h-10 w-10 cursor-pointer rounded border"
                                    />
                                    <Input
                                        id="primary-color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="accent-color">Accent Color</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                        className="h-10 w-10 cursor-pointer rounded border"
                                    />
                                    <Input
                                        id="accent-color"
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {message && (
                    <p className={`text-sm ${message.includes("Failed") ? "text-destructive" : "text-green-600"}`}>
                        {message}
                    </p>
                )}

                <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
            </form>

            <Separator className="my-8" />

            {/* Stripe Connect */}
            <Card>
                <CardHeader>
                    <CardTitle>Payments — Stripe Connect</CardTitle>
                </CardHeader>
                <CardContent>
                    {store?.stripeOnboardingComplete ? (
                        <div className="flex items-center gap-2">
                            <Badge variant="default">Connected</Badge>
                            <p className="text-sm text-muted-foreground">
                                Stripe account is active. Payments are enabled.
                            </p>
                        </div>
                    ) : store?.stripeAccountId ? (
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Stripe onboarding not yet complete.
                            </p>
                            <Button
                                className="mt-3"
                                variant="outline"
                                onClick={handleStripeConnect}
                                disabled={stripeConnectMutation.isPending}
                            >
                                {stripeConnectMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                )}
                                Continue Onboarding
                            </Button>
                        </div>
                    ) : (
                        <div>
                            <p className="mb-3 text-sm text-muted-foreground">
                                Connect your Stripe account to accept payments from customers.
                            </p>
                            <Button
                                onClick={handleStripeConnect}
                                disabled={stripeConnectMutation.isPending}
                            >
                                {stripeConnectMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                )}
                                Connect Stripe Account
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
