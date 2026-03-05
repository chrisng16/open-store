"use client"



import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from "@/components/ui/sidebar"
import { useStoresQuery } from "@/queries/stores"
import { Plus } from "lucide-react"
import Link from "next/link"

export function NavStores() {
    const { data, isPending } = useStoresQuery()

    if (isPending) {
        return (
            <SidebarGroup>
                <SidebarGroupLabel>Stores</SidebarGroupLabel>
                <SidebarMenu>
                    {[1, 2, 3].map((i) => (
                        <SidebarMenuItem key={i} >
                            <SidebarMenuButton tooltip="Loading..." isActive={false}>
                                <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                                <span className="sr-only">Loading...</span>
                            </SidebarMenuButton>

                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroup>
        )
    }

    const items = (data ?? []).map((store) => ({
        title: store.name,
        url: `/dashboard/${store.id}`,
        isActive: false
    }))

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Stores</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title} >
                        <SidebarMenuButton asChild tooltip={item.title} isActive={item.isActive}>
                            <Link href={item.url} className="group-data-[collapsible=icon]:border rounded-md transition-all duration-200">
                                <div className="flex transition-all duration-250 group-data-[collapsible=icon]:size-4 group-data-[collapsible=icon]:border-0 size-6 items-center justify-center rounded-md border shrink-0">
                                    <span className="text-xs font-medium">{item.title.slice(0, 1).toUpperCase()}</span>
                                </div>
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>

                    </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                    <Link href="/dashboard/store/new" >
                        <SidebarMenuButton className="text-sidebar-foreground/70" tooltip={'Create Store'}>
                            <Plus className="text-sidebar-foreground/70" />
                            <span>Create Store</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
    )
}
