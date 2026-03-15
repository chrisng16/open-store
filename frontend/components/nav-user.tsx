"use client"

import {
  BadgeCheck,
  Bell,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { User } from '@supabase/supabase-js'
import { ThemeSwitcherSubmenu } from "./theme-switcher-submenu"

interface NavUserProps {
  user: User | null;
}

export function NavUser({ user }: NavUserProps) {
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!user) {
    return <div>Not signed in</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="shrink-0">
        <Avatar className="rounded-md">
          <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.name} referrerPolicy="no-referrer" />
          <AvatarFallback>{user.user_metadata?.name?.[0]}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56"
        side='bottom'
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="rounded-md">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.name} referrerPolicy="no-referrer" />
              <AvatarFallback>{user.user_metadata?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.user_metadata?.name}</span>
              <span className="truncate text-xs">{user.user_metadata?.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Sparkles />
            Upgrade to Pro
          </DropdownMenuItem>
          <ThemeSwitcherSubmenu />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheck />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

  )
}
