import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, FileUp, Package, ShoppingBag } from "lucide-react";
import Link from "next/link";

interface StoreSubNavProps {
    storeId: string;
    storeName?: string;
    pending: boolean;
}

export default function StoreSubNav({ storeId, storeName, pending }: StoreSubNavProps) {
    const navItems = [
        { href: `/dashboard/${storeId}/orders`, label: "Orders", icon: ShoppingBag },
        { href: `/dashboard/${storeId}/products`, label: "Products", icon: Package },
        { href: `/dashboard/${storeId}/ai-import`, label: "AI Import", icon: FileUp },
    ];
    return (
        < div className="border-b rounded-t-md bg-background-elevated/70 backdrop-blur sticky top-0 z-10" >
            <div className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-4">
                    {
                        pending ? <Skeleton className="h-6 w-32" /> : <h2 className="font-semibold text-xl">{storeName || "Store"}</h2>
                    }
                    {storeName && (
                        <Link
                            href={`/store/${storeId}/products`}
                            target="_blank"
                            className="text-sm text-muted-foreground hover:text-foreground"
                        >
                            <ExternalLink className="inline h-3 w-3" />
                        </Link>
                    )}
                </div>
                <div className="flex gap-1">
                    {navItems.map((item) => {
                        return (
                            <Link key={item.href} href={item.href}>
                                <Button
                                    variant={"ghost"}
                                    size="sm"
                                >
                                    <item.icon className="mr-1 h-4 w-4" />
                                    {item.label}
                                </Button>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div >
    )
}
