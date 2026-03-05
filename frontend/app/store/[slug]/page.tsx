import { CartButton } from "@/components/store/cart-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Store = {
    id: string;
    name: string;
    description: string | null;
    banner_url: string | null;
    is_active: boolean;
};

type Product = {
    id: string;
    name: string;
    description: string | null;
    base_price: number;
    image_url: string | null;
};

type Category = {
    id: string;
    name: string;
};

async function getStoreBySlug(slug: string): Promise<Store | null> {
    try {
        const res = await fetch(`${API_URL}/stores/${slug}`, { next: { revalidate: 60 } });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

async function getCategories(storeId: string): Promise<Category[]> {
    try {
        const res = await fetch(`${API_URL}/stores/${storeId}/categories`, {
            next: { revalidate: 30 },
        });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

async function getProducts(storeId: string): Promise<Product[]> {
    try {
        const res = await fetch(`${API_URL}/stores/${storeId}/products`, {
            next: { revalidate: 30 },
        });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

export default async function StoreIndexPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const store = await getStoreBySlug(slug);

    if (!store) notFound();

    const [categories, products] = await Promise.all([
        getCategories(store.id),
        getProducts(store.id),
    ]);

    const featuredProducts = products.slice(0, 4);
    const bannerStyle = store.banner_url
        ? {
            backgroundImage: `linear-gradient(to right, color-mix(in srgb, var(--store-primary) 55%, transparent), color-mix(in srgb, var(--store-accent) 45%, transparent)), url(${store.banner_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
        }
        : {
            backgroundImage:
                "linear-gradient(to right, color-mix(in srgb, var(--store-primary) 45%, transparent), color-mix(in srgb, var(--store-accent) 35%, transparent))",
        };

    return (
        <div className="container mx-auto space-y-8 px-4 py-6">
            <section
                style={bannerStyle}
                className="overflow-hidden rounded-2xl border"
            >
                <div className="space-y-4 bg-background/70 px-6 py-10 backdrop-blur-sm md:max-w-xl md:py-14">
                    <Badge variant={store.is_active ? "secondary" : "destructive"}>
                        {store.is_active ? "Open for pickup" : "Temporarily unavailable"}
                    </Badge>
                    <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{store.name}</h2>
                    <p className="text-sm text-muted-foreground md:text-base">
                        {store.description || "Freshly prepared food, ready for pickup."}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/store/${slug}/menu`}>
                            <Button size="lg">Start order</Button>
                        </Link>
                        <CartButton slug={slug} />
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <h3 className="text-xl font-semibold tracking-tight">Browse by category</h3>
                <div className="flex flex-wrap gap-2">
                    {categories.slice(0, 8).map((category) => (
                        <Link
                            key={category.id}
                            href={`/store/${slug}/menu?category=${category.id}`}
                        >
                            <Badge variant="outline" className="px-3 py-1 text-sm">
                                {category.name}
                            </Badge>
                        </Link>
                    ))}
                    {categories.length === 0 && (
                        <p className="text-sm text-muted-foreground">Menu categories will appear here soon.</p>
                    )}
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold tracking-tight">Featured picks</h3>
                    <Link href={`/store/${slug}/menu`}>
                        <Button variant="ghost" size="sm">
                            View full menu
                        </Button>
                    </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {featuredProducts.map((product) => (
                        <Link key={product.id} href={`/store/${slug}/item/${product.id}`}>
                            <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                                {product.image_url && (
                                    <div className="aspect-4/3 overflow-hidden">
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                )}
                                <CardContent className="space-y-1 p-4">
                                    <p className="font-semibold leading-tight">{product.name}</p>
                                    {product.description && (
                                        <p className="line-clamp-2 text-sm text-muted-foreground">
                                            {product.description}
                                        </p>
                                    )}
                                    <p className="pt-1 font-medium">${Number(product.base_price).toFixed(2)}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {featuredProducts.length === 0 && (
                    <Card>
                        <CardContent className="py-10 text-center text-muted-foreground">
                            Featured items will appear once this store publishes products.
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    );
}
