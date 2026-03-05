import { Button } from "@/components/ui/button";
import { CreditCard, ShoppingBag, Sparkles, Store } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Store className="h-5 w-5" />
            Open Store
          </div>
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Launch your online food store in{" "}
            <span className="text-primary">minutes</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload your menu — our AI extracts every item, price, and modifier
            automatically. Get a branded storefront with ordering and payments,
            ready to share.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/signup">
              <Button size="lg">Create Your Store</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Everything you need
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<Sparkles className="h-8 w-8" />}
                title="AI Menu Import"
                description="Upload a PDF, photo, or spreadsheet. Our AI extracts items, prices, modifiers, and dietary tags."
              />
              <FeatureCard
                icon={<Store className="h-8 w-8" />}
                title="Branded Storefront"
                description="Your own customizable online store with your logo, colors, and unique URL."
              />
              <FeatureCard
                icon={<ShoppingBag className="h-8 w-8" />}
                title="Order Management"
                description="Real-time order tracking with status updates. Manage everything from your dashboard."
              />
              <FeatureCard
                icon={<CreditCard className="h-8 w-8" />}
                title="Stripe Payments"
                description="Accept payments securely with Stripe Connect. Funds go directly to your account."
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Open Store. Built with Next.js,
          FastAPI &amp; Supabase.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-3 text-primary">{icon}</div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
