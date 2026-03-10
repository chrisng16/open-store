"use client"

import {
    ChartNoAxesCombined,
    Frame,
    LayoutDashboard,
    LifeBuoy,
    Map,
    Package,
    PieChart,
    Send,
    ShoppingBag,
    SidebarIcon,
    Store,
    Users
} from "lucide-react"
import * as React from "react"

import { NavSecondary } from "@/components/nav-secondary"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    useSidebar
} from "@/components/ui/sidebar"
import { NavStores } from "./nav-stores"
import { Button } from "./ui/button"

const data = {
    navMain: [
        {
            title: "Analytics",
            url: "#",
            icon: ChartNoAxesCombined,
        },
        {
            title: "Orders",
            url: "#",
            icon: ShoppingBag,
        },
        {
            title: "Categories",
            url: "#",
            icon: LayoutDashboard,
        },

    ],
    navManage: [
        {
            title: "Store",
            url: "#",
            icon: Store,
            isActive: true
        },
        {
            title: "Categories",
            url: "#",
            icon: LayoutDashboard,
        },
        {
            title: "Products",
            url: "#",
            icon: Package,
        },
        {
            title: "Team",
            url: "#",
            icon: Users,
        },
    ],
    navSecondary: [
        {
            title: "Support",
            url: "#",
            icon: LifeBuoy,
        },
        {
            title: "Feedback",
            url: "#",
            icon: Send,
        },
    ],
    teams: [
        {
            name: "Design Engineering",
            url: "#",
            icon: Frame,
        },
        {
            name: "Sales & Marketing",
            url: "#",
            icon: PieChart,
        },
        {
            name: "Travel",
            url: "#",
            icon: Map,
        },
    ],
}

export function CreateStoreSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { toggleSidebar } = useSidebar()
    return (
        <Sidebar
            variant="inset"
            className="pt-0 overflow-auto overscroll-none top-(--header-height) h-[calc(100svh-var(--header-height))]!"
            {...props}
        >

            <SidebarContent className="pt-0">
                <NavStores />
                <NavSecondary items={data.navSecondary} activeRoute={null} className="mt-auto" />
            </SidebarContent>
            <SidebarFooter>
                <Button
                    className="h-8 w-8"
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                >
                    <SidebarIcon />
                </Button>
            </SidebarFooter>
        </Sidebar>
    )
}
