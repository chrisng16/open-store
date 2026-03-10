import { StoreProvider, type StoreData } from "@/lib/store-context";
import { notFound } from "next/navigation";
import StoreFooter from "./_components/store-footer";
import StoreHeader from "./_components/store-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function getStore(slug: string): Promise<StoreData | null> {
    try {
        const res = await fetch(`${API_URL}/stores/slug/${slug}`, {
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
            <div style={themeStyles} className="min-h-screen bg-background text-foreground">
                <StoreHeader store={store} slug={slug} />
                <main>{children}</main>
                <StoreFooter />
            </div>
        </StoreProvider>
    );
}
