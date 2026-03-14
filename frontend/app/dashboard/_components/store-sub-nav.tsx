"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { useTeamMembersQuery } from "@/queries/team";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, ExternalLink, FileUp, Package, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

interface StoreSubNavProps {
    storeId: string;
    storeName: string | undefined;
    storeSlug: string | undefined;
    pending: boolean;
}

export default function StoreSubNav({ storeId, storeName, pending, storeSlug }: StoreSubNavProps) {
    const membersQuery = useTeamMembersQuery(storeId);
    const currentUserIdQuery = useQuery({
        queryKey: ["current-user-id"],
        queryFn: async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            return data.user?.id ?? null;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    console.log("store-sub-nav")

    const isOwner = useMemo(() => {
        if (!currentUserIdQuery.data || !membersQuery.data) {
            return false;
        }
        const myMember = membersQuery.data.find((member) => member.userId === currentUserIdQuery.data);
        return myMember?.role === "owner";
    }, [currentUserIdQuery.data, membersQuery.data]);

    const navItems = [
        { href: `/dashboard/${storeId}/orders`, label: "Orders", icon: ShoppingBag },
        { href: `/dashboard/${storeId}/products`, label: "Products", icon: Package },
        { href: `/dashboard/${storeId}/ai-import`, label: "AI Import", icon: FileUp },
        ...(isOwner
            ? [{ href: `/dashboard/${storeId}/payments`, label: "Payments", icon: CreditCard }]
            : []),
    ];
    return (
        <div className="border-b rounded-t-md bg-background-elevated/70 backdrop-blur sticky top-0 z-10">
            <div className="flex items-center justify-between px-6 py-3">
                <div className="flex flex-col">
                    {
                        pending ? <Skeleton className="h-7 w-32" /> : <h2 className="font-semibold text-xl">{storeName || "Store"}</h2>
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
        </div>
    )
}
