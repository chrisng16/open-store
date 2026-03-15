"use client"
import { Menu } from 'lucide-react'
import { Button } from './ui/button'
import { useSidebar } from './ui/sidebar'

export default function SidebarTrigger({ ...props }: React.ComponentProps<"button">) {
    const { toggleSidebar } = useSidebar()
    return (
        <Button {...props} variant="ghost" size='icon' onClick={toggleSidebar} className="md:hidden">
            <span className="sr-only">Toggle sidebar</span>
            <Menu />
        </Button>
    )
}
