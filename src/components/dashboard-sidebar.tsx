import {
  LayoutDashboard,
  Heart,
  Activity,
  Moon,
  Weight,
  Users,
  Settings,
} from "lucide-react"

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard", active: true },
  { icon: Users, label: "Patient Management", href: "/dashboard/patients" },
  { icon: Heart, label: "Heart Rate", href: "#" },
  { icon: Activity, label: "Activity", href: "#" },
  { icon: Moon, label: "Sleep", href: "#" },
  { icon: Weight, label: "Weight", href: "#" },
  { icon: Settings, label: "Settings", href: "#" },
]

export function DashboardSidebar() {
  return (
    <aside className="hidden w-64 border-r bg-card p-6 md:block">
      <div className="mb-8">
        <h2 className="text-lg font-semibold">OpenClaw</h2>
        <p className="text-sm text-muted-foreground">Healthcare</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              item.active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  )
}
