"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Heart,
  Activity,
  Moon,
  Weight,
  Users,
  Settings,
  Menu,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"

interface NavItem {
  readonly icon: LucideIcon
  readonly label: string
  readonly href: string
}

const navItems: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: Users, label: "Patients", href: "/dashboard/patients" },
  { icon: Heart, label: "Heart Rate", href: "/dashboard/heart-rate" },
  { icon: Activity, label: "Activity", href: "/dashboard/activity" },
  { icon: Moon, label: "Sleep", href: "/dashboard/sleep" },
  { icon: Weight, label: "Weight", href: "/dashboard/weight" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
]

function NavLinks({ pathname, onClick }: { readonly pathname: string; readonly onClick?: () => void }) {
  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = item.href === "/dashboard"
          ? pathname === "/dashboard"
          : pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <>
      <aside className="hidden w-64 border-r bg-card p-6 md:block">
        <div className="mb-8">
          <h2 className="text-lg font-semibold">OpenClaw</h2>
          <p className="text-sm text-muted-foreground">Healthcare</p>
        </div>
        <NavLinks pathname={pathname} />
      </aside>

      <div className="flex items-center p-2 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-6">
            <div className="mb-8">
              <h2 className="text-lg font-semibold">OpenClaw</h2>
              <p className="text-sm text-muted-foreground">Healthcare</p>
            </div>
            <NavLinks pathname={pathname} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
