import { CartButton } from '@/components/store/cart-button';
import { Button } from '@/components/ui/button';
import { StoreData } from '@/lib/store-context';
import { Phone } from 'lucide-react';
import Link from 'next/link';

export default function StoreHeader({ store, slug }: { store: StoreData; slug: string }) {

    return (
        <header className="z-40 sticky top-0 bg-background supports-backdrop-filter:bg-background">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex gap-3 py-3 flex-row items-center justify-between">
                    <Link href={`/store/${slug}`} className="flex min-w-0 items-center gap-4">
                        {store.logo_url && (
                            <img
                                src={store.logo_url}
                                alt={store.name}
                                className="h-12 w-12 rounded-2xl border border-border/70 object-cover"
                            />
                        )}

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{store.name}</h1>
                            </div>
                            {store.description && (
                                <p className="line-clamp-1 max-w-2xl text-sm text-muted-foreground">{store.description}</p>
                            )}
                        </div>
                    </Link>

                    <div className="flex gap-3 lg:items-end">
                        <nav className="flex flex-wrap items-center gap-2" aria-label="Store navigation">
                            {store.phone && (
                                <Link href={`tel:${store.phone}`}>
                                    <Button variant="outline" size="sm" className="rounded-full px-4">
                                        <Phone />Call store
                                    </Button>
                                </Link>
                            )}
                            <Link href={`/store/${slug}/checkout`}>
                                <Button variant="outline" size="sm" className="rounded-full border border-transparent px-4 hover:border-border/80 hover:bg-card">
                                    Checkout
                                </Button>
                            </Link>
                            <Link href={`/store/${slug}/orders`}>
                                <Button variant="outline" size="sm" className="rounded-full border border-transparent px-4 hover:border-border/80 hover:bg-card">
                                    Track order
                                </Button>
                            </Link>
                        </nav>

                        <div className="flex flex-wrap items-center gap-2">

                            <CartButton slug={slug} storeId={store.id} size={'sm'} />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}
