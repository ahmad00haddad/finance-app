import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListOrdered, Search, PieChart, Plus, Gem } from "lucide-react";
import { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = { to: string; label: string; icon: typeof Home; primary?: boolean };
const items: NavItem[] = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/assets", label: "ذهب", icon: Gem },
  { to: "/months", label: "الأشهر", icon: ListOrdered },
  { to: "/add", label: "", icon: Plus, primary: true },
  { to: "/search", label: "بحث", icon: Search },
  { to: "/reports", label: "التقارير", icon: PieChart },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground">نظام الإدارة المالية</div>
            <div className="text-base font-bold text-brand-gradient">حساباتي الشاملة</div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="h-9 w-9 rounded-2xl bg-brand-gradient shadow-glow flex items-center justify-center text-primary-foreground font-black">₪</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pb-28 pt-4">{children}</main>
      <nav className="fixed bottom-3 inset-x-0 z-30 px-4">
        <div className="mx-auto max-w-md bg-card/90 backdrop-blur-xl border border-border rounded-3xl shadow-glow flex items-center justify-around p-2">
          {items.map(({ to, label, icon: Icon, primary }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            if (primary) {
              return (
                <Link key={to} to={to as never} className="-mt-7">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-primary-foreground shadow-glow active:scale-95 transition">
                    <Icon className="h-7 w-7" strokeWidth={2.5} />
                  </span>
                </Link>
              );
            }
            return (
              <Link key={to} to={to as never} className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}