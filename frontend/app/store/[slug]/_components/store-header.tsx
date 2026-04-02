"use client";
import { CartButton } from '@/components/store/cart-button';
import { Button } from '@/components/ui/button';
import { StorePublic } from '@/lib/types';
import { ClipboardList, Navigation, Phone } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StoreSidebar } from './store-sidebar';
import { StoreThemeToggle } from './store-theme-toggle';
import { StorefrontSearch } from './storefront-search';

export default function StoreHeader({ store, slug }: { store: StorePublic; slug: string }) {
    const pathname = usePathname();
    const isHomePage = pathname === `/store/${slug}`;

    const mapUrl = store.address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(store.address)}`
        : null;

    return (
        <header className="z-40 sticky top-0 bg-background">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex gap-3 py-3 flex-row items-center justify-between">
                    <div className="flex items-center gap-1 sm:gap-4 min-w-0">
                        <StoreSidebar store={store} slug={slug} />

                        <Link href={`/store/${slug}`} className="flex min-w-0 items-center gap-2 sm:gap-4 group">
                            {store.logoUrl && (
                                <img
                                    src={store.logoUrl}
                                    alt={store.name}
                                    className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl border border-border/70 object-cover transition-transform group-hover:scale-105"
                                />
                            )}

                            <div className="min-w-0">
                                <h1 className="truncate text-lg font-bold tracking-tight group-hover:text-primary transition-colors">
                                    {store.name}
                                </h1>
                                {store.description && (
                                    <p className="line-clamp-1 hidden lg:block max-w-50 text-xs text-muted-foreground">
                                        {store.description}
                                    </p>
                                )}
                            </div>
                        </Link>
                    </div>

                    {isHomePage && (
                        <div className="hidden md:flex flex-1 justify-center px-4">
                            <StorefrontSearch />
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Store contact">
                            {store.phone && (
                                <Link href={`tel:${store.phone}`} target="_blank">
                                    <Button variant="ghost" size="sm" className="rounded-full hover:bg-primary/5 hover:text-primary transition-all">
                                        <Phone className="size-3.5" />
                                        <span className="hidden sm:inline">Call</span>
                                    </Button>
                                </Link>
                            )}
                            {mapUrl && (
                                <Link href={mapUrl} target="_blank">
                                    <Button variant="ghost" size="sm" className="rounded-full hover:bg-primary/5 hover:text-primary transition-all">
                                        <Navigation className="size-3.5" />
                                        <span className="hidden sm:inline">Navigate</span>
                                    </Button>
                                </Link>
                            )}
                            <Link href={`/store/${slug}/orders`} className="hidden md:flex">
                                <Button variant="ghost" size="sm" className="rounded-full hover:bg-primary/5 hover:text-primary">
                                    <ClipboardList className="size-3.5" />
                                    <span>Orders</span>
                                </Button>
                            </Link>
                        </nav>

                        <div className="flex items-center gap-1.5">
                            <StoreThemeToggle className='hidden lg:flex' />
                            <CartButton slug={slug} storeId={store.id} size={'sm'} />
                        </div>
                    </div>
                </div>
                {isHomePage && (
                    <div className="md:hidden pb-2">
                        <StorefrontSearch />
                    </div>
                )}
            </div>
        </header>
    )
}
