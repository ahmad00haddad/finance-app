import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CURRENCY, fetchAllTransactions, formatAmount, formatMonthLabel, type Tx } from "@/lib/finance";
import { ChevronDown, ArrowDownLeft, ArrowUpRight, Trash2, ExternalLink, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditTransactionDialog } from "@/components/EditTransactionDialog";

export const Route = createFileRoute("/months/")({ component: MonthsPage });

const INITIAL_COUNT = 5;
const STEP = 5;

function MonthsPage() {
  const qc = useQueryClient();
  const [visible, setVisible] = useState(INITIAL_COUNT);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tx | null>(null);

  const { data } = useQuery({
    queryKey: ["transactions", "summary"],
    queryFn: fetchAllTransactions,
  });

  const byMonth = new Map<string, { income: number; expense: number; count: number }>();
  (data ?? []).forEach(t => {
    const m = byMonth.get(t.month_year) ?? { income: 0, expense: 0, count: 0 };
    if (t.type === "income") m.income += Number(t.amount); else m.expense += Number(t.amount);
    m.count++;
    byMonth.set(t.month_year, m);
  });
  const months = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  const shown = months.slice(0, visible);
  const hasMore = visible < months.length;

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("نُقلت إلى سلة المحذوفات"); },
  });

  return (
    <AppShell>
      <Toaster position="top-center" richColors />
      <h1 className="text-xl font-bold mb-1">التقارير الشهرية</h1>
      <p className="text-xs text-muted-foreground mb-4">{months.length} شهر · اضغط على الشهر لعرض التفاصيل</p>

      <ul className="space-y-2">
        {shown.map(([m, s]) => {
          const isOpen = expanded === m;
          const net = s.income - s.expense;
          return (
            <li key={m} className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : m)}
                className="w-full flex items-center justify-between p-4 active:scale-[0.99] transition text-right"
              >
                <div className="flex-1">
                  <div className="font-bold">{formatMonthLabel(m)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{s.count} معاملة</div>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-income">+{formatAmount(s.income)}</span>
                    <span className="text-expense">−{formatAmount(s.expense)}</span>
                  </div>
                </div>
                <div className="text-left mx-2">
                  <div className={`text-lg font-black ${net >= 0 ? "text-income" : "text-expense"}`}>
                    {formatAmount(net)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{CURRENCY} · صافي</div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && <MonthDetails monthYear={m} onDelete={(id) => { if (confirm("حذف المعاملة؟")) del.mutate(id); }} onEdit={setEditing} />}
            </li>
          );
        })}
        {!months.length && <li className="text-center text-sm text-muted-foreground py-12">لا توجد بيانات</li>}
      </ul>

      {hasMore && (
        <button
          onClick={() => setVisible(v => v + STEP)}
          className="mt-4 w-full rounded-2xl bg-card border border-border py-3 text-sm font-bold active:scale-[0.99] transition"
        >
          عرض المزيد ({months.length - visible} متبقي)
        </button>
      )}
      <EditTransactionDialog tx={editing} onClose={() => setEditing(null)} />
    </AppShell>
  );
}

function MonthDetails({ monthYear, onDelete, onEdit }: { monthYear: string; onDelete: (id: number) => void; onEdit: (tx: Tx) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["transactions", "month", monthYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("month_year", monthYear)
        .is("deleted_at", null)
        .order("id", { ascending: false });
      if (error) throw error;
      return data as Tx[];
    },
  });

  if (isLoading) return <div className="p-4 text-center text-xs text-muted-foreground border-t border-border">جاري التحميل...</div>;
  const txs = data ?? [];
  const cats = new Map<string, number>();
  txs.filter(t => t.type === "expense").forEach(t => cats.set(t.category ?? "أخرى", (cats.get(t.category ?? "أخرى") ?? 0) + Number(t.amount)));
  const topCats = Array.from(cats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="border-t border-border p-3 bg-background/40">
      {topCats.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-bold mb-2 text-muted-foreground">أعلى التصنيفات</div>
          <ul className="space-y-1.5">
            {topCats.map(([c, v]) => {
              const pct = expense ? (v / expense) * 100 : 0;
              return (
                <li key={c} className="bg-card border border-border rounded-xl p-2">
                  <div className="flex justify-between text-xs"><span className="font-medium">{c}</span><span className="font-bold">{formatAmount(v)}</span></div>
                  <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden"><div className="h-full bg-brand-gradient" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="text-xs font-bold mb-2 text-muted-foreground">جميع المعاملات ({txs.length})</div>
      <ul className="space-y-1.5">
        {txs.map(t => {
          const isIncome = t.type === "income";
          return (
            <li key={t.id} className="flex items-center gap-2 bg-card border border-border rounded-xl p-2">
              <span className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center ${isIncome ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
                {isIncome ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{t.description}</div>
                <div className="text-[10px] text-muted-foreground">{t.category}</div>
              </div>
              <div className={`text-xs font-bold ${isIncome ? "text-income" : "text-expense"}`}>{isIncome ? "+" : "−"}{formatAmount(Number(t.amount))}</div>
              <button onClick={() => onEdit(t)} className="p-1.5 text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => onDelete(t.id)} className="p-1.5 text-muted-foreground hover:text-expense"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          );
        })}
      </ul>

      <Link to="/months/$monthYear" params={{ monthYear }} className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground py-2">
        <ExternalLink className="h-3 w-3" /> فتح الصفحة الكاملة
      </Link>
    </div>
  );
}