"use client"
import { SearchForm } from "@/components/search-form"
import { NavUser } from "./nav-user"
import { StoreSwitcher } from "./store-switcher"

export function SiteHeader() {

  return (
    <header className="sticky top-0 z-50 flex w-full items-center">
      <div className="flex h-(--header-height) w-full items-center justify-between gap-2 px-4">
        {/* <Breadcrumb className="hidden sm:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Build Your Application</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Data Fetching</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb> */}
        {/* <Link href="#" className="flex gap-2">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
            <Command className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-2xl leading-tight">
            <span className="font-semibold">OpenStore</span>

          </div>
        </Link> */}
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-2xl">OpenStore</h1>
          <SearchForm className="w-full max-w-sm" />
        </div>
        <div className="flex items-center gap-4">
          <StoreSwitcher />
          <NavUser />
        </div>
      </div>
    </header>
  )
}
