import { SearchForm } from "@/components/search-form"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { NavUser } from "./nav-user"
import SidebarTrigger from "./sidebar-trigger"
import { StoreSwitcher } from "./store-switcher"

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 flex w-full items-center">
      <div className="flex h-(--header-height) w-full items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-1">
          <SidebarTrigger className="block sm:hidden" />
          <Link href="/" className="font-semibold text-xl px-3 -ml-3">OpenStore</Link>
          <div className="text-sm text-muted-foreground">/</div>
          <StoreSwitcher />
        </div>
        <div className="flex items-center gap-4">
          <SearchForm className="w-full max-w-sm hidden sm:block" />
          <NavUser user={user} />
        </div>
      </div>
    </header>
  )
}
