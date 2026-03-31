"use client";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function PaymentForm({ storeSlug, orderAccessToken, orderId }: { storeSlug: string, orderAccessToken: string | null, orderId: string | null }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const clearCart = useCartStore(state => state.clearCart);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements || !orderId) return;

        setLoading(true);

        const returnUrl = new URL(`${window.location.origin}/store/${storeSlug}/orders/${orderId}`);
        if (orderAccessToken) {
            returnUrl.searchParams.set("access", orderAccessToken);
        }

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: returnUrl.toString(),
            },
            redirect: "if_required"
        });

        if (error) {
            toast.error(error.message || "Payment failed");
            setLoading(false);
        } else {
            // Success! (for non-redirect payments)
            clearCart();
            toast.success("Payment successful!");
            router.push(returnUrl.pathname + returnUrl.search);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />
            <Button type="submit" className="w-full" disabled={loading || !stripe}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Pay Now"}
            </Button>
        </form>
    );
}