import { ProductDetail } from "@/components/store/product-detail";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function getStoreBySlug(slug: string) {
    const res = await fetch(`${API_URL}/stores/slug/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
}

async function getProduct(storeId: string, productId: string) {
    const res = await fetch(`${API_URL}/stores/${storeId}/products/${productId}`, {
        next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
}

export default async function ItemPage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>;
}) {
    const { slug, id } = await params;
    const store = await getStoreBySlug(slug);
    if (!store) notFound();

    const product = await getProduct(store.id, id);
    if (!product) notFound();

    return <ProductDetail product={product} slug={slug} />;
}
