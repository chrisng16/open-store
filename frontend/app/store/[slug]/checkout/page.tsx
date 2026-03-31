"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useCartPricing } from "@/lib/cart-pricing";
import { useCartSummary } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { getStripe } from "@/lib/stripe";
import { Elements } from "@stripe/react-stripe-js";
import { ChevronRight, CreditCard, Loader2, MapPin, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import PaymentForm from "./_components/payment-form";


export default function CheckoutPage() {
    const store = useStore();
    const { items, itemCount } = useCartSummary(store.slug);
    const { subtotal: localSubtotal } = useCartPricing({ storeId: store.id, items });

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

    useEffect(() => {
        if (itemCount === 0 && step === 1) {
            // If cart is empty and we're at start, maybe redirect back?
            // But let the user see the empty state or handle it.
        }
    }, [itemCount, step]);

    const handleAddressSubmit = async (e: React.FormEvent) => {
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
            setStep(2);
        } catch (error: any) {
            console.error("Checkout initiation failed:", error);
            toast.error(error.message || "Failed to initiate checkout");
        } finally {
            setLoading(false);
        }
    };

    if (itemCount === 0 && step === 1) {
        return (
            <div className="container mx-auto max-w-2xl py-20 px-4 flex flex-col items-center justify-center text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
                <p className="text-muted-foreground mb-8">Add some items to your cart before checking out.</p>
                <Button onClick={() => router.push(`/store/${store.slug}`)}>
                    Back to Shop
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-5xl py-8 md:py-12 px-4">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
                <div className="flex items-center gap-2 text-sm font-medium">
                    <div className={`flex items-center gap-1 ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>1</div>
                        <span>Address</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <div className={`flex items-center gap-1 ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>2</div>
                        <span>Payment</span>
                    </div>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    {step === 1 ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" />
                                    Shipping & Contact Information
                                </CardTitle>
                                <CardDescription>Enter where you'd like your order delivered.</CardDescription>
                            </CardHeader>
                            <form onSubmit={handleAddressSubmit}>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Full Name</Label>
                                            <Input
                                                id="name"
                                                required
                                                value={customer.name}
                                                onChange={e => setCustomer({ ...customer, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                required
                                                value={customer.email}
                                                onChange={e => setCustomer({ ...customer, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone (Optional)</Label>
                                        <Input
                                            id="phone"
                                            value={customer.phone}
                                            onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                                        />
                                    </div>
                                    <Separator className="my-4" />
                                    <div className="space-y-2">
                                        <Label htmlFor="line1">Address Line 1</Label>
                                        <Input
                                            id="line1"
                                            required
                                            value={address.line1}
                                            onChange={e => setAddress({ ...address, line1: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="line2">Address Line 2 (Optional)</Label>
                                        <Input
                                            id="line2"
                                            value={address.line2}
                                            onChange={e => setAddress({ ...address, line2: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="city">City</Label>
                                            <Input
                                                id="city"
                                                required
                                                value={address.city}
                                                onChange={e => setAddress({ ...address, city: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="state">State / Province</Label>
                                            <Input
                                                id="state"
                                                required
                                                value={address.state}
                                                onChange={e => setAddress({ ...address, state: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="postalCode">Postal Code</Label>
                                            <Input
                                                id="postalCode"
                                                required
                                                value={address.postalCode}
                                                onChange={e => setAddress({ ...address, postalCode: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="country">Country</Label>
                                            <Input
                                                id="country"
                                                required
                                                value={address.country}
                                                onChange={e => setAddress({ ...address, country: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Continue to Payment"}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <MapPin className="h-5 w-5 text-muted-foreground" />
                                            Shipping To
                                        </CardTitle>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-primary hover:text-primary hover:bg-primary/10">
                                        Change
                                    </Button>
                                </CardHeader>
                                <CardContent className="text-sm">
                                    <div className="font-medium">{customer.name}</div>
                                    <div className="text-muted-foreground">
                                        {address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />
                                        {address.city}, {address.state} {address.postalCode}<br />
                                        {address.country}
                                    </div>
                                    <div className="mt-2 text-muted-foreground">
                                        {customer.email} {customer.phone ? `• ${customer.phone}` : ""}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CreditCard className="h-5 w-5" />
                                        Payment Details
                                    </CardTitle>
                                    <CardDescription>Secure payment powered by Stripe.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {clientSecret && (
                                        <Elements stripe={getStripe(store.stripeAccountId || undefined)} options={{ clientSecret }}>
                                            <PaymentForm
                                                storeSlug={store.slug}
                                                orderAccessToken={orderAccessToken}
                                                orderId={orderId}
                                            />
                                        </Elements>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <div key={item.id} className="flex justify-between text-sm">
                                        <span>{item.product_name} x {item.quantity}</span>
                                        {/* Since prices aren't in the cart store for security, 
                                            we might not show item totals here until Step 2 
                                            or if we had them cached. For now, let's keep it simple. */}
                                    </div>
                                ))}
                            </div>
                            <Separator />
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{totals ? `$${(totals.subtotal / 100).toFixed(2)}` : `$${(localSubtotal / 100).toFixed(2)}`}</span>
                                </div>
                                {step === 2 && totals && (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Service Fee</span>
                                            <span>{`$${(totals.platformFee / 100).toFixed(2)}`}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">
                                                Tax ({totals.taxRate}%)
                                            </span>
                                            <span>{`$${(totals.tax / 100).toFixed(2)}`}</span>
                                        </div>
                                        <div className="flex justify-between font-bold">
                                            <span>Total</span>
                                            <span>{`$${(totals.total / 100).toFixed(2)}`}</span>
                                        </div>
                                    </>
                                )}
                                {step === 1 && (
                                    <p className="text-[10px] text-muted-foreground mt-2">
                                        Tax and total will be calculated in the next step.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}


