"use client"
import { SearchForm } from "@/components/search-form"
import { NavUser } from "./nav-user"
import SidebarTrigger from "./sidebar-trigger"
import { StoreSwitcher } from "./store-switcher"

export function SiteHeader() {

  return (
    <header className="sticky top-0 z-50 flex w-full items-center">
      <div className="flex h-(--header-height) w-full items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="block sm:hidden" />
          <h1 className="font-semibold text-xl">OpenStore</h1>
          <SearchForm className="w-full max-w-sm hidden sm:block" />
        </div>
        <div className="flex items-center gap-4">
          <StoreSwitcher />
          <NavUser />
        </div>
      </div>
    </header>
  )
}
