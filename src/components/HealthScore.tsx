import { useMemo } from "react";
import { Heart } from "lucide-react";
import type { Tx } from "@/lib/finance";

export function HealthScore({ transactions }: { transactions: Tx[] }) {
  const score = useMemo(() => computeHealthScore(transactions), [transactions]);

  const tone =
    score.value >= 75 ? { c: "text-income", bg: "bg-income/15 border-income/30", label: "ممتاز" } :
    score.value >= 50 ? { c: "text-primary", bg: "bg-primary/15 border-primary/30", label: "جيد" } :
    score.value >= 25 ? { c: "text-amber-500", bg: "bg-amber-500/15 border-amber-500/30", label: "متوسط" } :
                        { c: "text-expense", bg: "bg-expense/15 border-expense/30", label: "ضعيف" };

  return (
    <section className={`rounded-3xl border p-4 ${tone.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className={`h-5 w-5 ${tone.c}`} />
          <h2 className="font-bold text-sm">درجة الصحة المالية</h2>
        </div>
        <span className={`text-xs font-bold ${tone.c}`}>{tone.label}</span>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <div className={`text-5xl font-black ${tone.c}`}>{score.value}</div>
        <div className="text-xs text-muted-foreground mb-2">/ 100</div>
      </div>

      <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all`} style={{ width: `${score.value}%`, background: "currentColor" }} />
      </div>

      <ul className="space-y-1 text-[11px]">
        {score.breakdown.map(b => (
          <li key={b.label} className="flex items-center justify-between">
            <span className="text-muted-foreground">{b.label}</span>
            <span className="font-bold">{b.value}/{b.max}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function computeHealthScore(txs: Tx[]) {
  if (!txs.length) return { value: 0, breakdown: [] as { label: string; value: number; max: number }[] };

  const months = new Map<string, { income: number; expense: number }>();
  txs.forEach(t => {
    const v = months.get(t.month_year) ?? { income: 0, expense: 0 };
    if (t.type === "income") v.income += Number(t.amount);
    else v.expense += Number(t.amount);
    months.set(t.month_year, v);
  });

  const monthArr = Array.from(months.values());
  const totalIncome = monthArr.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthArr.reduce((s, m) => s + m.expense, 0);

  // 1. Savings ratio (0-40): (income-expense)/income
  const savingsRatio = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;
  const savings = Math.max(0, Math.min(40, Math.round(savingsRatio * 100 * 0.8)));

  // 2. Profitable months (0-25)
  const profitable = monthArr.filter(m => m.income - m.expense > 0).length;
  const profitScore = Math.round((profitable / monthArr.length) * 25);

  // 3. Category diversity (0-15)
  const cats = new Set(txs.filter(t => t.type === "expense").map(t => t.category ?? "أخرى"));
  const diversity = Math.min(15, cats.size);

  // 4. Spending stability (0-20) — lower std dev relative to mean = better
  const expenses = monthArr.map(m => m.expense);
  const mean = expenses.reduce((s, v) => s + v, 0) / expenses.length;
  const variance = expenses.reduce((s, v) => s + (v - mean) ** 2, 0) / expenses.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  const stability = Math.max(0, Math.round(20 * (1 - Math.min(1, cv))));

  const value = savings + profitScore + diversity + stability;

  return {
    value,
    breakdown: [
      { label: "نسبة التوفير", value: savings, max: 40 },
      { label: "الأشهر الرابحة", value: profitScore, max: 25 },
      { label: "ثبات الإنفاق", value: stability, max: 20 },
      { label: "تنوّع التصنيفات", value: diversity, max: 15 },
    ],
  };
}