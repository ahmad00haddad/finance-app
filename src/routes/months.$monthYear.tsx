import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { CURRENCY, formatAmount, formatMonthLabel, type Tx } from "@/lib/finance";
import { ArrowRight, Trash2, ArrowDownLeft, ArrowUpRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AiInsights } from "@/components/AiInsights";
import { EditTransactionDialog } from "@/components/EditTransactionDialog";
import { useState } from "react";

export const Route = createFileRoute("/months/$monthYear")({ component: MonthDetail });

function MonthDetail() {
  const { monthYear } = Route.useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tx | null>(null);
  const { data } = useQuery({
    queryKey: ["transactions", "month", monthYear],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("month_year", monthYear).is("deleted_at", null).order("id", { ascending: false });
      if (error) throw error;
      return data as Tx[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => { const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() } as any).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries(); toast.success("نُقلت إلى سلة المحذوفات"); },
  });

  const txs = data ?? [];
  const income = txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const cats = new Map<string, number>();
  txs.filter(t => t.type === "expense").forEach(t => cats.set(t.category ?? "أخرى", (cats.get(t.category ?? "أخرى") ?? 0) + Number(t.amount)));
  const topCats = Array.from(cats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <AppShell>
      <Toaster position="top-center" richColors />
      <Link to="/months" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3"><ArrowRight className="h-4 w-4" /> العودة</Link>
      <h1 className="text-xl font-bold mb-4">{formatMonthLabel(monthYear)}</h1>

      <div className="rounded-3xl bg-brand-gradient p-5 text-primary-foreground shadow-glow">
        <div className="text-xs opacity-90">صافي الربح الشهري</div>
        <div className="text-3xl font-black mt-1">{formatAmount(income - expense)} <span className="text-sm">{CURRENCY}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-black/15 p-3"><div className="text-[11px] opacity-85">الإيرادات</div><div className="font-bold">{formatAmount(income)}</div></div>
          <div className="rounded-2xl bg-black/15 p-3"><div className="text-[11px] opacity-85">المصروفات</div><div className="font-bold">{formatAmount(expense)}</div></div>
        </div>
      </div>

      {topCats.length > 0 && (
        <section className="mt-5">
          <h2 className="font-bold mb-2">أعلى التصنيفات</h2>
          <ul className="space-y-2">
            {topCats.map(([c, v]) => {
              const pct = expense ? (v / expense) * 100 : 0;
              return (
                <li key={c} className="bg-card border border-border rounded-2xl p-3">
                  <div className="flex justify-between text-sm"><span className="font-medium">{c}</span><span className="font-bold">{formatAmount(v)}</span></div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-brand-gradient" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <h2 className="font-bold mb-2">جميع المعاملات ({txs.length})</h2>
        <ul className="space-y-2">
          {txs.map(t => {
            const isIncome = t.type === "income";
            return (
              <li key={t.id} className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3">
                <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${isIncome ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
                  {isIncome ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.description}</div>
                  <div className="text-[11px] text-muted-foreground">{t.category}</div>
                </div>
                <div className={`text-sm font-bold ${isIncome ? "text-income" : "text-expense"}`}>{isIncome ? "+" : "−"}{formatAmount(Number(t.amount))}</div>
                <button onClick={() => setEditing(t)} className="p-2 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => { if (confirm("حذف المعاملة؟")) del.mutate(t.id); }} className="p-2 text-muted-foreground hover:text-expense"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-5">
        <AiInsights scope="month" label={formatMonthLabel(monthYear)} transactions={txs} />
      </div>

      <EditTransactionDialog tx={editing} onClose={() => setEditing(null)} />
    </AppShell>
  );
}