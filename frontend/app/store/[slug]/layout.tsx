import { CartButton } from "@/components/store/cart-button";
import { Button } from "@/components/ui/button";
import { StoreProvider, type StoreData } from "@/lib/store-context";
import Link from "next/link";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function getStore(slug: string): Promise<StoreData | null> {
    try {
        const res = await fetch(`${API_URL}/stores/${slug}`, {
            next: { revalidate: 60 },
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export default async function StoreLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const store = await getStore(slug);

    if (!store) notFound();

    const themeStyles = {
        "--store-primary": store.theme_config?.primaryColor || "#2563eb",
        "--store-accent": store.theme_config?.accentColor || "#f59e0b",
    } as React.CSSProperties;

    return (
        <StoreProvider store={store}>
            <div style={themeStyles} className="min-h-screen bg-background">
                {/* Store header */}
                <header className="z-40 border-b bg-card/95 backdrop-blur">
                    <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        {store.logo_url && (
                            <img
                                src={store.logo_url}
                                alt={store.name}
                                className="h-10 w-10 rounded-full object-cover"
                            />
                        )}
                        <div className="mr-auto min-w-55">
                            <h1 className="text-base font-bold tracking-tight md:text-lg">{store.name}</h1>
                            {store.description && (
                                <p className="line-clamp-1 text-sm text-muted-foreground">{store.description}</p>
                            )}
                        </div>

                        <nav className="flex items-center gap-1 rounded-full border bg-background/70 p-1">
                            <Link href={`/store/${slug}`}>
                                <Button variant="ghost" size="sm" className="rounded-full">
                                    Home
                                </Button>
                            </Link>
                            <Link href={`/store/${slug}/menu`}>
                                <Button variant="ghost" size="sm" className="rounded-full">
                                    Menu
                                </Button>
                            </Link>
                            <Link href={`/store/${slug}/checkout`}>
                                <Button variant="ghost" size="sm" className="rounded-full">
                                    Checkout
                                </Button>
                            </Link>
                        </nav>

                        <div className="flex items-center gap-2">
                            {store.phone && (
                                <a href={`tel:${store.phone}`}>
                                    <Button variant="outline" size="sm" className="rounded-full">
                                        Call
                                    </Button>
                                </a>
                            )}
                            <CartButton slug={slug} />
                        </div>
                    </div>
                </header>
                <main>{children}</main>
            </div>
        </StoreProvider>
    );
}
