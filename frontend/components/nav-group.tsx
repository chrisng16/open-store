"use client"

import {
  type LucideIcon
} from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar"
import Link from "next/link"
import { useParams } from "next/navigation"

export function NavGroup({
  items, navGroupTitle, activeRoute
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon,
    isActive?: boolean
  }[],
  activeRoute: string | null
  navGroupTitle: string
}) {
  const params = useParams();
  const storeId = params.storeId as string | undefined;

  const withStore = (itemUrl: string) => {
    // normalize itemUrl to be a path suffix
    const suffix = itemUrl.startsWith("/") ? itemUrl : `/${itemUrl}`;
    if (!storeId) return suffix || "#"; // fallback (or return "#" / disable)
    return `/dashboard/${storeId}${suffix}`;
  };
  return (
    <SidebarGroup className="pt-0">
      <SidebarGroupLabel>{navGroupTitle}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild isActive={item.title.toLowerCase().replace(" ", "-") === activeRoute} tooltip={item.title}>
              <Link href={withStore(item.url)}>
                <item.icon />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
