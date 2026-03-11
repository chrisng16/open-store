"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { useTeamMembersQuery } from "@/queries/team";
import { CreditCard, ExternalLink, FileUp, Package, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface StoreSubNavProps {
    storeId: string;
    storeName: string;
    storeSlug: string;
    pending: boolean;
}

export default function StoreSubNav({ storeId, storeName, pending, storeSlug }: StoreSubNavProps) {
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const membersQuery = useTeamMembersQuery(storeId);

    useEffect(() => {
        const supabase = createClient();
        void supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data.user?.id ?? null);
        });
    }, []);

    const isOwner = useMemo(() => {
        if (!currentUserId || !membersQuery.data) {
            return false;
        }
        const myMember = membersQuery.data.find((member) => member.userId === currentUserId);
        return myMember?.role === "owner";
    }, [currentUserId, membersQuery.data]);

    const navItems = [
        { href: `/dashboard/${storeId}/orders`, label: "Orders", icon: ShoppingBag },
        { href: `/dashboard/${storeId}/products`, label: "Products", icon: Package },
        { href: `/dashboard/${storeId}/ai-import`, label: "AI Import", icon: FileUp },
        ...(isOwner
            ? [{ href: `/dashboard/${storeId}/payments`, label: "Payments", icon: CreditCard }]
            : []),
    ];
    return (
        < div className="border-b rounded-t-md bg-background-elevated/70 backdrop-blur sticky top-0 z-10" >
            <div className="flex items-center justify-between px-6 py-3">
                <div className="flex flex-col">
                    {
                        pending ? <Skeleton className="h-6 w-32" /> : <h2 className="font-semibold text-xl">{storeName || "Store"}</h2>
                    }
                    <Link
                        href={`/store/${storeSlug}/`}
                        target="_blank"
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center"
                    >
                        View Store <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
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
