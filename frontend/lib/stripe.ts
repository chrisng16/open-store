import { loadStripe } from "@stripe/stripe-js";

export function getStripe(stripeAccount?: string) {
    return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
        stripeAccount,
    });
}
