import { MenuBrowser } from "@/components/store/menu-browser";
import { StoreNotActive } from "@/components/store/store-not-active";
import { api } from "@/lib/api";
import { Category, ProductWithCategoryListItem, Store } from "@/lib/types";

async function getCategories(storeId: string): Promise<Category[]> {
    return api.categories.list(storeId);
}

async function getProducts(storeId: string): Promise<ProductWithCategoryListItem[]> {
    return api.products.list(storeId);
}

async function getStoreBySlug(slug: string): Promise<Store> {
    return api.stores.getBySlug(slug);
}

export default async function MenuPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ category?: string }>;
}) {
    const { slug } = await params;
    const { category } = await searchParams;

    const store = await getStoreBySlug(slug);

    console.log("Fetched store for slug:", slug, store); // Debug log
    if (!store) return <div className="p-8 text-center">Store not found</div>;

    if (store && store.isActive === false) {
        return <StoreNotActive storeName={store.name} />;
    }

    const [categories, products] = await Promise.all([
        getCategories(store.id),
        getProducts(store.id),
    ]);

    const activeCategoryIds = new Set(categories.map((cat) => cat.id));
    const visibleProducts = products.filter(
        (product) => !product.categoryId || activeCategoryIds.has(product.categoryId)
    );

    const productsByCategory = categories.map((cat) => ({
        ...cat,
        products: visibleProducts.filter((p) => p.categoryId === cat.id),
    }));

    // Include uncategorized products
    const uncategorized = visibleProducts.filter((p) => !p.categoryId);

    const hasRequestedCategory =
        category && categories.some((cat) => cat.id === category);
    const defaultTab = hasRequestedCategory
        ? category
        : categories[0]?.id || (uncategorized.length > 0 ? "other" : "all");

    const sections = [
        ...productsByCategory,
        ...(uncategorized.length > 0
            ? [{ id: "other", name: "Other", description: null, products: uncategorized }]
            : []),
    ];

    return (
        <>
            {visibleProducts.length === 0 ? (
                <div className="py-16 text-center">
                    <p className="text-lg text-muted-foreground">
                        This store hasn&apos;t added any items yet
                    </p>
                </div>
            ) : (
                <MenuBrowser
                    storeId={store.id}
                    slug={slug}
                    storeName={store.name}
                    storeDescription={store.description}
                    sections={
                        sections.length > 0
                            ? sections
                            : [{ id: "all", name: "Menu", description: null, products: visibleProducts }]
                    }
                    defaultCategory={defaultTab}
                />
            )}
        </>
    );
}
