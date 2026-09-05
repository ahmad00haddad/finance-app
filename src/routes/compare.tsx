import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { CURRENCY, fetchAllTransactions, formatAmount, formatMonthLabel } from "@/lib/finance";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

export const Route = createFileRoute("/compare")({ component: ComparePage });

function ComparePage() {
  const { data: txs } = useQuery({ queryKey: ["transactions", "all"], queryFn: fetchAllTransactions });

  const allMonths = useMemo(() => {
    const s = new Set<string>();
    (txs ?? []).forEach(t => s.add(t.month_year));
    return Array.from(s).sort();
  }, [txs]);

  const [monthA, setMonthA] = useState("");
  const [monthB, setMonthB] = useState("");

  useEffect(() => {
    if (allMonths.length >= 2 && !monthA) {
      setMonthA(allMonths[allMonths.length - 2]);
      setMonthB(allMonths[allMonths.length - 1]);
    }
  }, [allMonths, monthA]);

  const summary = useMemo(() => {
    if (!txs || !monthA || !monthB) return null;
    const calc = (m: string) => {
      const arr = txs.filter(t => t.month_year === m);
      const income = arr.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expense = arr.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      const cats = new Map<string, number>();
      arr.filter(t => t.type === "expense").forEach(t => {
        const k = t.category ?? "أخرى";
        cats.set(k, (cats.get(k) ?? 0) + Number(t.amount));
      });
      return { income, expense, net: income - expense, count: arr.length, cats };
    };
    return { a: calc(monthA), b: calc(monthB) };
  }, [txs, monthA, monthB]);

  const catCompare = useMemo(() => {
    if (!summary) return [];
    const keys = new Set([...summary.a.cats.keys(), ...summary.b.cats.keys()]);
    return Array.from(keys)
      .map(k => ({ name: k, a: summary.a.cats.get(k) ?? 0, b: summary.b.cats.get(k) ?? 0 }))
      .sort((x, y) => (y.a + y.b) - (x.a + x.b))
      .slice(0, 10);
  }, [summary]);

  const chartData = summary ? [
    { name: "إيرادات", [formatMonthLabel(monthA)]: summary.a.income, [formatMonthLabel(monthB)]: summary.b.income },
    { name: "مصروفات", [formatMonthLabel(monthA)]: summary.a.expense, [formatMonthLabel(monthB)]: summary.b.expense },
    { name: "صافي", [formatMonthLabel(monthA)]: summary.a.net, [formatMonthLabel(monthB)]: summary.b.net },
  ] : [];

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-1 flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-primary" /> مقارنة بين الأشهر</h1>
      <p className="text-xs text-muted-foreground mb-4">قارن أداء شهرين جنباً إلى جنب</p>

      <section className="bg-card border border-border rounded-3xl p-4 mb-4 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-muted-foreground">الشهر الأول</span>
          <select value={monthA} onChange={e => setMonthA(e.target.value)} className="mt-1 w-full bg-muted/50 border border-border rounded-2xl px-3 py-2.5 text-sm outline-none">
            {allMonths.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">الشهر الثاني</span>
          <select value={monthB} onChange={e => setMonthB(e.target.value)} className="mt-1 w-full bg-muted/50 border border-border rounded-2xl px-3 py-2.5 text-sm outline-none">
            {allMonths.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
        </label>
      </section>

      {summary && (
        <>
          <section className="grid grid-cols-2 gap-2 mb-4">
            <MonthCard label={formatMonthLabel(monthA)} d={summary.a} />
            <MonthCard label={formatMonthLabel(monthB)} d={summary.b} />
          </section>

          <section className="bg-card border border-border rounded-3xl p-4 mb-4">
            <h2 className="text-sm font-bold mb-3">الفروقات</h2>
            <Diff label="الإيرادات" a={summary.a.income} b={summary.b.income} positiveIsGood />
            <Diff label="المصروفات" a={summary.a.expense} b={summary.b.expense} />
            <Diff label="الصافي" a={summary.a.net} b={summary.b.net} positiveIsGood />
          </section>

          <section className="bg-card border border-border rounded-3xl p-4 mb-4">
            <h2 className="text-sm font-bold mb-3">رسم بياني</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor" }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={formatMonthLabel(monthA)} fill="#3b82f6" radius={[6,6,0,0]} />
                  <Bar dataKey={formatMonthLabel(monthB)} fill="#f97316" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-card border border-border rounded-3xl p-4 mb-4">
            <h2 className="text-sm font-bold mb-3">مقارنة التصنيفات (أعلى 10)</h2>
            <ul className="space-y-1.5 text-xs">
              {catCompare.map(c => {
                const diff = c.b - c.a;
                return (
                  <li key={c.name} className="bg-muted/20 rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{c.name}</span>
                      <span className={`text-[11px] font-bold ${diff > 0 ? "text-expense" : diff < 0 ? "text-income" : "text-muted-foreground"}`}>
                        {diff > 0 ? "+" : ""}{formatAmount(diff)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <span className="text-muted-foreground">{formatAmount(c.a)}</span>
                      <span className="text-muted-foreground text-left">{formatAmount(c.b)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </AppShell>
  );
}

function MonthCard({ label, d }: { label: string; d: { income: number; expense: number; net: number; count: number } }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3">
      <div className="text-sm font-bold mb-2">{label}</div>
      <div className="text-[11px] flex justify-between"><span>إيراد</span><span className="text-income">+{formatAmount(d.income)}</span></div>
      <div className="text-[11px] flex justify-between"><span>مصروف</span><span className="text-expense">−{formatAmount(d.expense)}</span></div>
      <div className="text-[11px] flex justify-between border-t border-border mt-1 pt-1">
        <span>الصافي</span>
        <span className={`font-bold ${d.net >= 0 ? "text-income" : "text-expense"}`}>{formatAmount(d.net)}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">{d.count} معاملة</div>
    </div>
  );
}

function Diff({ label, a, b, positiveIsGood }: { label: string; a: number; b: number; positiveIsGood?: boolean }) {
  const diff = b - a;
  const pct = a !== 0 ? (diff / Math.abs(a)) * 100 : 0;
  const up = diff > 0;
  const isGood = positiveIsGood ? up : !up;
  const Icon = diff === 0 ? Minus : up ? TrendingUp : TrendingDown;
  const color = diff === 0 ? "text-muted-foreground" : isGood ? "text-income" : "text-expense";
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0 text-xs">
      <span>{label}</span>
      <span className={`flex items-center gap-1.5 font-bold ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {diff > 0 ? "+" : ""}{formatAmount(diff)} {CURRENCY}
        <span className="text-[10px] opacity-80">({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)</span>
      </span>
    </div>
  );
}