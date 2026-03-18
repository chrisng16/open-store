"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { type Store } from "@/lib/types";
import { useTeamMembersQuery } from "@/queries/team";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, CreditCard, ExternalLink, FileUp, Package, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { StoreActiveToggle } from "./store-active-toggle";

interface StoreSubNavProps {
    store?: Store;
    pending: boolean;
}

export default function StoreSubNav({ pending, store }: StoreSubNavProps) {
    const membersQuery = useTeamMembersQuery(store?.id);
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

    const isOwner = useMemo(() => {
        if (!currentUserIdQuery.data || !membersQuery.data) {
            return false;
        }
        const myMember = membersQuery.data.find((member) => member.userId === currentUserIdQuery.data);
        return myMember?.role === "owner";
    }, [currentUserIdQuery.data, membersQuery.data]);

    const navItems = [
        { href: `/dashboard/${store?.id}/orders`, label: "Orders", icon: ShoppingBag },
        { href: `/dashboard/${store?.id}/products`, label: "Products", icon: Package },
        { href: `/dashboard/${store?.id}/ai-import`, label: "AI Import", icon: FileUp },
        { href: `/dashboard/${store?.id}/analytics`, label: "Analytics", icon: BarChart2 },
        ...(isOwner
            ? [{ href: `/dashboard/${store?.id}/payments`, label: "Payments", icon: CreditCard }]
            : []),
    ];
    return (
        <div className="border-b rounded-t-md bg-background-elevated/70 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-3">
                <div className="flex flex-col">
                    {
                        pending ? <Skeleton className="h-4 w-32" /> : <h1 className="text-base font-semibold">{store?.name || "Store"}</h1>
                    }
                    <Link
                        href={`/store/${store?.slug}/`}
                        target="_blank"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center"
                    >
                        View Store <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                </div>
                {/* Store Active Toggle (Owner only) */}
                {!pending && isOwner && (
                    <StoreActiveToggle store={store} />
                )}
                {/* <div className="flex items-center gap-1">
                    <div className="hidden sm:flex md:hidden lg:flex gap-1">
                        {navItems.map((item) => (
                            <Link key={item.href} href={item.href}>
                                <Button variant={"ghost"} size="sm">
                                    <item.icon />
                                    {item.label}
                                </Button>
                            </Link>
                        ))}
                    </div>

                    <div className="flex sm:hidden md:flex lg:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    <Zap />
                                    Quick Links
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {navItems.map((item) => (
                                    <DropdownMenuItem key={item.href} asChild>
                                        <Link href={item.href} className="flex items-center gap-2">
                                            <item.icon className="h-4 w-4" />
                                            {item.label}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div> */}
            </div>
        </div>
    )
}
