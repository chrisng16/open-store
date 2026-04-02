"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store-context";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function OrderLookupPage() {
    const router = useRouter();
    const params = useParams<{ slug: string }>();
    const slug = params.slug;
    const store = useStore();

    const [orderIdentifier, setOrderIdentifier] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setError(null);

        const normalizedOrder = orderIdentifier.trim();
        const normalizedEmail = email.trim();
        const normalizedPhone = phone.trim();

        if (!normalizedOrder) {
            setError("Enter your order number.");
            return;
        }

        if (!normalizedEmail && !normalizedPhone) {
            setError("Enter either your email or phone number.");
            return;
        }

        setLoading(true);
        try {
            const lookup = await api.orders.lookup(store.id, {
                orderIdentifier: normalizedOrder,
                email: normalizedEmail || undefined,
                phone: normalizedPhone || undefined,
            });

            const access = encodeURIComponent(lookup.orderAccessToken);
            router.push(`/store/${slug}/orders/${lookup.orderId}?access=${access}`);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setError("We could not find that order with the provided contact details.");
            } else {
                setError(err instanceof Error ? err.message : "Unable to look up your order right now.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
            <Card className="rounded-[1.75rem] border-border/70">
                <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Order Lookup</p>
                    <CardTitle className="text-3xl">Find your order</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Enter your order number and either the email or phone used at checkout.
                    </p>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="order-number">Order number</Label>
                            <Input
                                id="order-number"
                                value={orderIdentifier}
                                onChange={(e) => setOrderIdentifier(e.target.value)}
                                placeholder="Example: K7XP-0042 or 20250315-K7XP-0042"
                                autoCapitalize="characters"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email (optional)</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone (optional)</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="(555) 123-4567"
                            />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <div className="flex flex-wrap gap-3 pt-2">
                            <Button type="submit" disabled={loading}>
                                {loading ? "Searching..." : "Find order"}
                            </Button>
                            <Link href={`/store/${slug}`}>
                                <Button type="button" variant="outline">
                                    Back to menu
                                </Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
