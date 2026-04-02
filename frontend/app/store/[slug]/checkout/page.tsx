"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useCartPricing } from "@/lib/cart-pricing";
import { useCartSummary } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { getStripe } from "@/lib/stripe";
import { cn } from "@/lib/utils";
import { Elements } from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { ArrowLeft, Check, CreditCard, Edit2, Info, Loader2, MapPin, Package, ShieldCheck, ShoppingBag, User } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";
import PaymentForm from "./_components/payment-form";

export default function CheckoutPage() {
    const store = useStore();
    const { items, itemCount } = useCartSummary(store.slug);
    const { subtotal: localSubtotal } = useCartPricing({ storeId: store.id, items });
    const { resolvedTheme } = useTheme();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [orderAccessToken, setOrderAccessToken] = useState<string | null>(null);
    const [totals, setTotals] = useState<{ subtotal: number, tax: number, taxRate: number, platformFee: number, total: number } | null>(null);

    const [address, setAddress] = useState({
        line1: "",
        line2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "US",
    });
    const [customer, setCustomer] = useState({
        name: "",
        email: "",
        phone: "",
    });

    const router = useRouter();

    const handleInfoSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStep(2);
    };

    const handleBillingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                items: items.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    options: item.options.map(opt => ({
                        option_id: opt.option_id,
                        quantity: opt.quantity
                    }))
                })),
                shipping_address: {
                    line1: address.line1,
                    line2: address.line2 || null,
                    city: address.city,
                    state: address.state,
                    postal_code: address.postalCode,
                    country: address.country,
                },
                customer_name: customer.name,
                customer_email: customer.email,
                customer_phone: customer.phone || null,
                notes: "",
            };

            const response = await api.orders.initiateCheckout(store.id, payload);
            setClientSecret(response.clientSecret);
            setOrderId(response.orderId);
            setOrderAccessToken(response.orderAccessToken);
            setTotals({
                subtotal: response.subtotal,
                tax: response.tax,
                taxRate: response.taxRate,
                platformFee: response.platformFee,
                total: response.total
            });
            setStep(3);
        } catch (error: any) {
            console.error("Checkout initiation failed:", error);
            toast.error(error.message || "Failed to initiate checkout");
        } finally {
            setLoading(false);
        }
    };

    const editBilling = () => {
        setTotals(null);
        setStep(2);
    };

    if (itemCount === 0 && step === 1) {
        return (
            <div className="container mx-auto max-w-xl py-24 px-4 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
                <p className="text-muted-foreground mb-8">Add some items to your cart before checking out.</p>
                <Link href={`/store/${store.slug}`}>
                    <Button variant="default">Browse Menu</Button>
                </Link>
            </div>
        );
    }

    const steps = [
        { id: 1, label: "Info" },
        { id: 2, label: "Billing" },
        { id: 3, label: "Payment" }
    ];

    const isDarkTheme = resolvedTheme === "dark";

    const paymentAppearance: Appearance = {
        theme: isDarkTheme ? "night" : "stripe",
        variables: {
            fontSizeBase: "14px",
            spacingUnit: "4px",
            borderRadius: "10px",
            colorPrimary: isDarkTheme ? "#e6e6e6" : "#111827",
            colorBackground: isDarkTheme ? "#1f1f1f" : "#ffffff",
            colorText: isDarkTheme ? "#f5f5f5" : "#111827",
            colorTextSecondary: isDarkTheme ? "#a3a3a3" : "#6b7280",
            colorDanger: isDarkTheme ? "#fb7185" : "#dc2626",
            colorSuccess: isDarkTheme ? "#34d399" : "#059669",
            colorWarning: isDarkTheme ? "#fbbf24" : "#d97706",
            colorIcon: isDarkTheme ? "#d4d4d4" : "#4b5563",
            colorTextPlaceholder: isDarkTheme ? "#737373" : "#9ca3af",
            colorBorder: isDarkTheme ? "#3f3f46" : "#d1d5db",
            colorBorderHover: isDarkTheme ? "#52525b" : "#9ca3af",
            colorBorderFocus: isDarkTheme ? "#a3a3a3" : "#374151",
            colorBackgroundSecondary: isDarkTheme ? "#262626" : "#f9fafb"
        } as Appearance["variables"],
        rules: {
            ".Block": {
                backgroundColor: isDarkTheme ? "#1f1f1f" : "#ffffff",
                border: `1px solid ${isDarkTheme ? "#3f3f46" : "#e5e7eb"}`,
                boxShadow: "none"
            },
            ".Input": {
                backgroundColor: isDarkTheme ? "#262626" : "#ffffff",
                border: `1px solid ${isDarkTheme ? "#52525b" : "#d1d5db"}`,
                boxShadow: "none"
            },
            ".Input:focus": {
                border: `1px solid ${isDarkTheme ? "#a3a3a3" : "#374151"}`,
                boxShadow: `0 0 0 3px ${isDarkTheme ? "rgba(163, 163, 163, 0.22)" : "rgba(55, 65, 81, 0.16)"}`
            },
            ".Input--invalid": {
                border: `1px solid ${isDarkTheme ? "#fb7185" : "#dc2626"}`
            },
            ".Tab": {
                border: `1px solid ${isDarkTheme ? "#3f3f46" : "#d1d5db"}`,
                boxShadow: "none"
            },
            ".Tab:hover": {
                color: isDarkTheme ? "#fafafa" : "#111827"
            },
            ".Tab--selected": {
                border: `1px solid ${isDarkTheme ? "#71717a" : "#9ca3af"}`,
                boxShadow: "none"
            },
            ".Error": {
                color: isDarkTheme ? "#fda4af" : "#b91c1c"
            },
            ".Label": {
                color: isDarkTheme ? "#d4d4d4" : "#4b5563"
            }
        }
    };

    return (
        <div className="bg-muted/20">
            <div className="container mx-auto max-w-5xl py-8 px-4">
                <div className="flex flex-col gap-4 mb-8">
                    <Link href={`/store/${store.slug}`} className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 w-fit">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Shop
                    </Link>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <h1 className="text-3xl font-bold">Checkout</h1>

                        <div className="flex items-center gap-2">
                            {steps.map((s, idx) => (
                                <React.Fragment key={s.id}>
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "flex items-center justify-center h-8 w-8 rounded-full border-2 transition-colors",
                                            step > s.id ? "bg-primary border-primary text-primary-foreground" :
                                                step === s.id ? "border-primary text-primary font-bold" : "border-muted text-muted-foreground"
                                        )}>
                                            {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                                        </div>
                                        <span className={cn(
                                            "text-xs font-bold uppercase tracking-widest hidden xs:inline",
                                            step === s.id ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            {s.label}
                                        </span>
                                    </div>
                                    {idx < steps.length - 1 && (
                                        <div className={cn("h-px w-4 sm:w-8 transition-colors", step > s.id ? "bg-primary" : "bg-muted")} />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
                    <div className="space-y-4">
                        {/* STEP 1: INFO */}
                        <Card className={cn("transition-all duration-300 overflow-hidden", step !== 1 && "bg-card/50")}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-colors", step >= 1 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold">Customer Information</CardTitle>
                                            {step > 1 && (
                                                <div className="text-sm text-muted-foreground mt-0.5">
                                                    {customer.name} • {customer.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {step > 1 && (
                                        <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="h-8 gap-1.5 text-primary hover:text-primary hover:bg-primary/5 font-bold text-xs uppercase tracking-widest">
                                            <Edit2 className="h-3 w-3" />
                                            Edit
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            {step === 1 && (
                                <form onSubmit={handleInfoSubmit} className="animate-in slide-in-from-top-2 duration-300">
                                    <CardContent className="px-6 pb-6 pt-0 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Full Name</Label>
                                            <Input id="name" required value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email Address</Label>
                                            <Input id="email" type="email" required value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Phone Number (Optional)</Label>
                                            <Input id="phone" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
                                        </div>
                                    </CardContent>
                                    <CardFooter className="px-6 pb-6 pt-0">
                                        <Button type="submit" className="w-full" size="lg">
                                            Continue to Billing
                                        </Button>
                                    </CardFooter>
                                </form>
                            )}
                        </Card>

                        {/* STEP 2: BILLING */}
                        <Card className={cn("transition-all duration-300 overflow-hidden", step < 2 && "opacity-60", step === 3 && "bg-card/50")}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-colors", step >= 2 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                            <MapPin className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold">Billing Address</CardTitle>
                                            {step > 2 && (
                                                <div className="text-sm text-muted-foreground mt-0.5">
                                                    {address.line1}, {address.city}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {step > 2 && (
                                        <Button variant="ghost" size="sm" onClick={editBilling} className="h-8 gap-1.5 text-primary hover:text-primary hover:bg-primary/5 font-bold text-xs uppercase tracking-widest">
                                            <Edit2 className="h-3 w-3" />
                                            Edit
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            {step === 2 && (
                                <form onSubmit={handleBillingSubmit} className="animate-in slide-in-from-top-2 duration-300">
                                    <CardContent className="px-6 pb-6 pt-0 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="line1">Address Line 1</Label>
                                            <Input id="line1" required value={address.line1} onChange={e => setAddress({ ...address, line1: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="line2">Address Line 2 (Optional)</Label>
                                            <Input id="line2" value={address.line2} onChange={e => setAddress({ ...address, line2: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="city">City</Label>
                                                <Input id="city" required value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="state">State</Label>
                                                <Input id="state" required value={address.state} onChange={e => setAddress({ ...address, state: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="postalCode">Postal Code</Label>
                                                <Input id="postalCode" required value={address.postalCode} onChange={e => setAddress({ ...address, postalCode: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="country">Country</Label>
                                                <Input id="country" required value={address.country} readOnly className="bg-muted cursor-not-allowed" />
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="px-6 pb-6 pt-0">
                                        <Button type="submit" className="w-full" size="lg" disabled={loading}>
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Continue to Payment"}
                                        </Button>
                                    </CardFooter>
                                </form>
                            )}
                        </Card>

                        {/* STEP 3: PAYMENT */}
                        <Card className={cn("transition-all duration-300 overflow-hidden", step < 3 && "opacity-60")}>
                            <CardHeader className="flex items-center gap-3">
                                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-colors", step >= 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                    <CreditCard className="h-4 w-4" />
                                </div>
                                <CardTitle className="text-lg font-bold">Payment Details</CardTitle>
                            </CardHeader>
                            {step === 3 && (
                                <CardContent className="px-6 pb-6 pt-0 space-y-6 animate-in slide-in-from-top-2 duration-300">
                                    {clientSecret && (
                                        <Elements
                                            stripe={getStripe(store.stripeAccountId || undefined)}
                                            options={{
                                                clientSecret,
                                                appearance: paymentAppearance
                                            }}
                                        >
                                            <PaymentForm storeSlug={store.slug} storeId={store.id} orderAccessToken={orderAccessToken} orderId={orderId} />
                                        </Elements>
                                    )}
                                    <div className="flex justify-center border-t pt-4">
                                        <p className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1.5">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Encrypted & Secure Payment
                                        </p>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    </div>

                    {/* Order Summary Sidebar */}
                    <aside className="space-y-6 lg:sticky lg:top-24 h-fit">
                        <Card className="shadow-sm">
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-2 font-bold">
                                    <ShoppingBag className="h-4 w-4" />
                                    Order Summary
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2.5">
                                    {items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-start text-sm">
                                            <span className="text-muted-foreground">{item.product_name} <span className="text-foreground/50 text-xs">x{item.quantity}</span></span>
                                        </div>
                                    ))}
                                </div>
                                <Separator />
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-medium">{totals ? `$${(totals.subtotal / 100).toFixed(2)}` : `$${(localSubtotal / 100).toFixed(2)}`}</span>
                                    </div>
                                    {totals && (
                                        <div className="flex justify-between items-center text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <span>Taxes & Fees</span>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button className="inline-flex">
                                                                <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="p-3 space-y-2 min-w-45">
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-muted-foreground">Service Fee</span>
                                                                <span className="font-medium text-background">{`$${(totals.platformFee / 100).toFixed(2)}`}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-muted-foreground">Tax ({totals.taxRate}%)</span>
                                                                <span className="font-medium text-background">{`$${(totals.tax / 100).toFixed(2)}`}</span>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <span className="font-medium text-foreground">{`$${((totals.tax + totals.platformFee) / 100).toFixed(2)}`}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between pt-2 text-base font-bold">
                                        <span>Total</span>
                                        <span>{totals ? `$${(totals.total / 100).toFixed(2)}` : `$${(localSubtotal / 100).toFixed(2)}`}</span>
                                    </div>
                                </div>
                                {!totals && (
                                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                        <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
                                            Taxes and fees will be calculated once billing address is provided.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </div>
    );
}
