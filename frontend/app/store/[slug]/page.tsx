import { MenuBrowser } from "@/components/store/menu-browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Option = {
    id: string;
    name: string;
    unit_amount: number;
    min_option_choice_quantity: number;
    max_option_choice_quantity: number;
    default_quantity: number;
};

type OptionList = {
    id: string;
    name: string;
    selection_node: "single_select" | "multi_select" | "aggregate_quantity";
    min_num_options: number;
    max_num_options: number;
    min_aggregate_options_quantity: number;
    max_aggregate_options_quantity: number;
    is_optional: boolean;
    options: Option[];
};

type Product = {
    id: string;
    store_id: string;
    category_id: string | null;
    name: string;
    description: string | null;
    unit_amount: number;
    image_url: string | null;
    dietary_tags: string[] | null;
    allergens: string[] | null;
    option_lists: OptionList[];
};

type Category = {
    id: string;
    name: string;
    description: string | null;
};

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

async function getStoreBySlug(slug: string) {
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
    if (!store) return <div className="p-8 text-center">Store not found</div>;

    const [categories, products] = await Promise.all([
        getCategories(store.id),
        getProducts(store.id),
    ]);

    const productsByCategory = categories.map((cat) => ({
        ...cat,
        products: products.filter((p) => p.category_id === cat.id),
    }));

    // Include uncategorized products
    const uncategorized = products.filter(
        (p) => !p.category_id || !categories.some((c) => c.id === p.category_id)
    );

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
            {products.length === 0 ? (
                <div className="py-16 text-center">
                    <p className="text-lg text-muted-foreground">
                        This store hasn&apos;t added any items yet
                    </p>
                </div>
            ) : (
                <MenuBrowser
                    slug={slug}
                    storeName={store.name}
                    storeDescription={store.description}
                    sections={sections.length > 0 ? sections : [{ id: "all", name: "Menu", description: null, products }]}
                    defaultCategory={defaultTab}
                />
            )}
        </>
    );
}
