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
import { useStoreCapabilities } from "@/hooks/use-store-capabilities"
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
  const pathParts = React.useMemo(() => pathname?.split("/").filter(Boolean) ?? [], [pathname])
  const storeId = pathParts[0] === "dashboard" ? pathParts[1] : undefined
  const capabilities = useStoreCapabilities(storeId)

  const activeRoute = React.useMemo(() => {
    if (!pathname) return null
    if (pathParts.length < 3) return 'general'
    return pathParts[2]
  }, [pathParts, pathname])

  const navStoreSetup = React.useMemo(() => {
    const items = [...data.navStoreSetup]
    if (!storeId || capabilities.isLoading) {
      return items
    }

    return items.filter((item) => {
      if (item.title === "Payments") {
        return capabilities.canAccessPayments
      }
      if (item.title === "General") {
        return capabilities.canAccessDashboard
      }
      return true
    })
  }, [capabilities.canAccessDashboard, capabilities.canAccessPayments, capabilities.isLoading, storeId])

  const navCatalog = React.useMemo(() => {
    const items = [...data.navCatalog]
    if (!storeId || capabilities.isLoading) {
      return items
    }

    return items.filter((item) => {
      if (item.title === "AI Import") {
        return capabilities.canManageProducts
      }
      return capabilities.canManageProducts || capabilities.canManageCategories
    })
  }, [capabilities.canManageCategories, capabilities.canManageProducts, capabilities.isLoading, storeId])

  const navOperations = React.useMemo(() => {
    const items = [...data.navOperations]
    if (!storeId || capabilities.isLoading) {
      return items
    }

    return items.filter((item) => {
      if (item.title === "Orders") {
        return capabilities.canViewOrders
      }
      if (item.title === "Analytics") {
        return capabilities.canViewAnalytics
      }
      return true
    })
  }, [capabilities.canViewAnalytics, capabilities.canViewOrders, capabilities.isLoading, storeId])

  return (
    <Sidebar
      variant="inset"
      className="pt-0 overflow-auto overscroll-none top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarContent className="pt-0">
        {navStoreSetup.length > 0 ? (
          <NavGroup
            items={navStoreSetup}
            navGroupTitle="Store Settings"
            activeRoute={activeRoute}
          />
        ) : null}
        {navCatalog.length > 0 ? (
          <NavGroup
            items={navCatalog}
            navGroupTitle="Catalog"
            activeRoute={activeRoute}
          />
        ) : null}
        {navOperations.length > 0 ? (
          <NavGroup
            items={navOperations}
            navGroupTitle="Operations"
            activeRoute={activeRoute}
          />
        ) : null}
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