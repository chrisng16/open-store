"use client"

import {
  Boxes,
  ChartNoAxesCombined,
  Frame,
  LifeBuoy,
  Map,
  Package,
  PieChart,
  Send,
  ShoppingBag,
  SidebarIcon,
  Sparkles,
  Store,
  Users
} from "lucide-react"
import * as React from "react"

import { NavGroup } from "@/components/nav-group"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  useSidebar
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"

const data = {
  navDashboard: [
    {
      title: "Analytics",
      url: "/analytics",
      icon: ChartNoAxesCombined,
    },
    {
      title: "Orders",
      url: "/orders",
      icon: ShoppingBag,
    },
  ],
  navManage: [
    {
      title: "Store",
      url: "/",
      icon: Store,
    },
    {
      title: "Categories",
      url: "/categories",
      icon: Boxes,
    },
    {
      title: "Products",
      url: "/products",
      icon: Package,
    },
    {
      title: "AI Import",
      url: "/ai-import",
      icon: Sparkles,
    },
    {
      title: "Team",
      url: "/team",
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { toggleSidebar } = useSidebar()

  const pathname = usePathname()
  const activeRoute = React.useMemo(() => {
    if (!pathname) return null
    const parts = pathname.split("/").filter(Boolean)
    if (parts.length < 3) return 'store'
    return parts[2]
  }, [pathname])

  console.log(activeRoute)

  return (
    <Sidebar
      variant="inset"
      className="pt-0 overflow-auto overscroll-none top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >

      <SidebarContent className="pt-0">
        <NavGroup items={data.navManage} navGroupTitle="Manage" activeRoute={activeRoute} />
        <NavGroup items={data.navDashboard} navGroupTitle="Dashboard" activeRoute={activeRoute} />
        <NavSecondary items={data.navSecondary} activeRoute={activeRoute} className="mt-auto" />
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
