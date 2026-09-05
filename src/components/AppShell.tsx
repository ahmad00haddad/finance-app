import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListOrdered, PieChart, Plus, Gem, Wallet, Search } from "lucide-react";
import { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = { to: string; label: string; icon: typeof Home; primary?: boolean };
const items: NavItem[] = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/assets", label: "ذهب", icon: Gem },
  { to: "/add", label: "", icon: Plus, primary: true },
  { to: "/months", label: "الأشهر", icon: ListOrdered },
  { to: "/reports", label: "التقارير", icon: PieChart },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full border border-primary/30 bg-card flex items-center justify-center overflow-hidden">
              <div className="w-full h-full bg-gradient-to-tr from-primary to-gold-light opacity-40" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">نظام الإدارة المالية</div>
              <div className="text-sm font-semibold text-primary">حساباتي الشاملة</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/search"
              className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition"
              aria-label="بحث"
            >
              <Search className="h-4 w-4" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-6 pb-32 pt-6">{children}</main>
      <nav className="fixed bottom-6 inset-x-0 z-30 px-6">
        <div className="mx-auto max-w-md bg-card/90 backdrop-blur-xl border border-border rounded-[2rem] shadow-2xl p-2 flex items-center justify-between">
          {items.map(({ to, label, icon: Icon, primary }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            if (primary) {
              return (
                <Link key={to} to={to as never} className="-mt-8">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-primary-foreground shadow-glow active:scale-95 transition border-4 border-background">
                    <Icon className="h-7 w-7" strokeWidth={2.5} />
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={to}
                to={to as never}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
