"use client"

import { useStoresQuery } from "@/queries/stores"
import { ChevronsUpDown, Plus } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"

export function StoreSwitcher() {
    const router = useRouter()
    const pathname = usePathname()
    const { data, isLoading } = useStoresQuery()

    const stores = React.useMemo(
        () =>
            (data ?? []).map((store) => ({
                id: store.id,
                name: store.name,
                slug: store.slug,
            })),
        [data]
    )

    const routeStoreId = React.useMemo(() => {
        if (!pathname) return null
        const parts = pathname.split("/").filter(Boolean)
        if (parts[0] !== "dashboard" || parts.length < 2) return null
        if (parts[1] === "store") return null
        return parts[1]
    }, [pathname])

    const activeStore = React.useMemo(() => {
        if (stores.length === 0) return null
        if (routeStoreId) {
            const fromRoute = stores.find((store) => store.id === routeStoreId)
            if (fromRoute) return fromRoute
        }
        return stores[0]
    }, [stores, routeStoreId])

    const handleSelectStore = React.useCallback(
        (storeId: string) => {
            const parts = pathname.split("/").filter(Boolean)
            if (parts[0] === "dashboard" && parts.length >= 2 && parts[1] !== "store") {
                const tail = parts.slice(2).join("/")
                const nextPath = tail ? `/dashboard/${storeId}/${tail}` : `/dashboard/${storeId}`
                router.push(nextPath)
                return
            }

            router.push(`/dashboard/${storeId}`)
        },
        [pathname, router]
    )

    if (isLoading || !activeStore) {

        return <div className="flex items-center gap-2 p-2">
            <Skeleton className="h-6 w-24" />
            <ChevronsUpDown className="text-muted-foreground size-4" />
        </div>

    }
    return (
        routeStoreId && <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant={'ghost'} size={'sm'}>
                    <span className="text-base font-semibold">{activeStore.name}</span>
                    <ChevronsUpDown className="text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                align="start"
                side={"bottom"}
                sideOffset={4}
            >
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                    Stores
                </DropdownMenuLabel>
                {stores.map((store, index) => (
                    <DropdownMenuItem
                        key={store.id}
                        onClick={() => handleSelectStore(store.id)}
                        className="gap-2 p-2"
                    >
                        <div className="flex size-6 items-center justify-center rounded-md border">
                            <span className="text-xs font-medium">{store.name.slice(0, 1).toUpperCase()}</span>
                        </div>
                        {store.name}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" onClick={() => router.push("/dashboard/store/new")}>
                    <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                        <Plus className="size-4" />
                    </div>
                    <div className="text-muted-foreground font-medium">Add store</div>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
