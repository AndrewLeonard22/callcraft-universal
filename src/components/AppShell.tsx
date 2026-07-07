import { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  Building2,
  FileText,
  GraduationCap,
  Headphones,
  Menu,
  Phone,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// App shell (Fable, 2026-07-06 rebuild): ONE sidebar for the whole product.
// Every page was rolling its own header — the Lovable pattern that made the
// app read as a pile of screens instead of one piece of software. Pages render
// inside; page-specific actions ride the header slot.

const NAV_MAIN = [
  { to: "/", label: "Companies", icon: Building2, end: true },
  { to: "/training", label: "Training", icon: GraduationCap },
  { to: "/templates", label: "Templates", icon: FileText },
];

const NAV_MANAGE = [
  { to: "/call-agents", label: "Call agents", icon: Phone },
  { to: "/team", label: "Team", icon: Users },
  { to: "/service-types", label: "Services", icon: Wrench },
];

export function BrandMark({ size = 30, icon = 15 }: { size?: number; icon?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[9px]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(125deg, hsl(218 100% 55%), hsl(258 90% 62%))",
        boxShadow: "0 4px 12px hsl(218 100% 55% / 0.3)",
      }}
    >
      <Headphones color="#fff" size={icon} strokeWidth={2.4} />
    </div>
  );
}

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Building2; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex h-9 items-center gap-2.5 rounded-[8px] px-3 text-[13.5px] font-medium transition-colors ${
          isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      {label}
    </NavLink>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-border bg-card px-3 py-4 lg:flex">
        <Link to="/" className="flex items-center gap-2.5 px-2 py-1">
          <BrandMark />
          <span className="text-[15px] font-bold tracking-tight text-foreground">Agent IQ</span>
        </Link>
        <nav className="mt-6 flex flex-col gap-0.5">
          {NAV_MAIN.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>
        <div className="mt-6 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          Manage
        </div>
        <nav className="mt-1.5 flex flex-col gap-0.5">
          {NAV_MANAGE.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>
      </aside>

      {/* content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[58px] items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          {/* mobile nav */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {[...NAV_MAIN, ...NAV_MANAGE].map((n) => (
                  <DropdownMenuItem key={n.to} asChild>
                    <Link to={n.to} className="flex cursor-pointer items-center">
                      <n.icon className="mr-2 h-4 w-4" />
                      {n.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="lg:hidden">
            <BrandMark size={26} icon={13} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-foreground">{title}</h1>
            {subtitle && <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
