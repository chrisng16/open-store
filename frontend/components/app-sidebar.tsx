"use client"

import {
  Boxes,
  ChartNoAxesCombined,
  CreditCard,
  LifeBuoy,
  Package,
  Send,
  ShoppingBag,
  SidebarIcon,
  Sparkles,
  Store,
  Users,
} from "lucide-react"
import * as React from "react"

import { NavGroup } from "@/components/nav-group"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"

const data = {
  navStoreSetup: [
    {
      title: "General",
      url: "/",
      icon: Store,
    },
    {
      title: "Team",
      url: "/team",
      icon: Users,
    },
    {
      title: "Payments",
      url: "/payments",
      icon: CreditCard,
    },
  ],
  navCatalog: [
    {
      title: "Products",
      url: "/products",
      icon: Package,
    },
    {
      title: "Categories",
      url: "/categories",
      icon: Boxes,
    },
    {
      title: "AI Import",
      url: "/ai-import",
      icon: Sparkles,
    },
  ],
  navOperations: [
    {
      title: "Orders",
      url: "/orders",
      icon: ShoppingBag,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: ChartNoAxesCombined,
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
}

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { toggleSidebar } = useSidebar()

  const pathname = usePathname()
  const activeRoute = React.useMemo(() => {
    if (!pathname) return null
    const parts = pathname.split("/").filter(Boolean)
    if (parts.length < 3) return 'general'
    return parts[2]
  }, [pathname])

  return (
    <Sidebar
      variant="inset"
      className="pt-0 overflow-auto overscroll-none top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarContent className="pt-0">
        <NavGroup
          items={data.navStoreSetup}
          navGroupTitle="Store Settings"
          activeRoute={activeRoute}
        />
        <NavGroup
          items={data.navCatalog}
          navGroupTitle="Catalog"
          activeRoute={activeRoute}
        />
        <NavGroup
          items={data.navOperations}
          navGroupTitle="Operations"
          activeRoute={activeRoute}
        />
        <NavSecondary
          items={data.navSecondary}
          activeRoute={activeRoute}
          className="mt-auto"
        />
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