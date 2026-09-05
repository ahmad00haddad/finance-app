import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CURRENCY, fetchAllTransactions, formatAmount, formatMonthLabel, type Tx } from "@/lib/finance";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, YAxis, CartesianGrid, Legend } from "recharts";
import { Trophy, TrendingDown, TrendingUp, Repeat, ArrowDownLeft, ArrowUpRight, PiggyBank, ChevronDown, ChevronUp, ArrowLeftRight, Shield, Layers, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AiInsights } from "@/components/AiInsights";
import { BackupButton } from "@/components/BackupButton";
import { HealthScore } from "@/components/HealthScore";
import { ZakatHawl } from "@/components/ZakatHawl";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

const PIE_COLORS = ["#f97316","#ef4444","#eab308","#22c55e","#3b82f6","#a855f7","#ec4899","#14b8a6"];

type ReportMode = "all" | "year" | "compare";

function ReportsPage() {
  const { data: txs } = useQuery({
    queryKey: ["transactions", "reports"],
    queryFn: fetchAllTransactions,
  });

  const allYears = useMemo(() => {
    const s = new Set<string>();
    (txs ?? []).forEach(t => s.add(t.month_year.slice(0, 4)));
    return Array.from(s).sort();
  }, [txs]);

  const [mode, setMode] = useState<ReportMode>("all");
  const [year, setYear] = useState<string>("");
  const [yearA, setYearA] = useState<string>("");
  const [yearB, setYearB] = useState<string>("");

  // initialize defaults once years available
  useMemo(() => {
    if (allYears.length && !year) setYear(allYears[allYears.length - 1]);
    if (allYears.length >= 2 && !yearA) { setYearA(allYears[allYears.length - 2]); setYearB(allYears[allYears.length - 1]); }
  }, [allYears, year, yearA]);

  const filtered = useMemo(() => {
    if (!txs) return [];
    if (mode === "year" && year) return txs.filter(t => t.month_year.startsWith(year));
    return txs;
  }, [txs, mode, year]);

  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const net = totalIncome - totalExpense;

  const months = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>();
    filtered.forEach(t => {
      const v = m.get(t.month_year) ?? { income: 0, expense: 0 };
      if (t.type === "income") v.income += Number(t.amount); else v.expense += Number(t.amount);
      m.set(t.month_year, v);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);
  const monthCount = months.length || 1;

  // category breakdown
  const catData = useMemo(() => {
    const c = new Map<string, number>();
    filtered.filter(t => t.type === "expense").forEach(t => c.set(t.category ?? "أخرى", (c.get(t.category ?? "أخرى") ?? 0) + Number(t.amount)));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, pct: totalExpense ? (value / totalExpense) * 100 : 0 }));
  }, [filtered, totalExpense]);

  const [recurringSort, setRecurringSort] = useState<"total" | "count">("total");

  // recurring expenses (by description)
  const recurring = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    filtered.filter(t => t.type === "expense").forEach(t => {
      const v = m.get(t.description) ?? { total: 0, count: 0 };
      v.total += Number(t.amount); v.count += 1;
      m.set(t.description, v);
    });
    return Array.from(m.entries())
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => recurringSort === "total" ? b[1].total - a[1].total : b[1].count - a[1].count)
      .slice(0, 10)
      .map(([desc, v]) => ({ desc, total: v.total, count: v.count, avg: v.total / v.count }));
  }, [filtered, recurringSort]);

  const topExpenses = useMemo(() => filtered.filter(t => t.type === "expense").sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 10), [filtered]);
  const topIncomes = useMemo(() => filtered.filter(t => t.type === "income").sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 10), [filtered]);

  const worstMonths = useMemo(() => [...months].sort((a, b) => b[1].expense - a[1].expense).slice(0, 10), [months]);
  const bestSavings = useMemo(() => [...months].sort((a, b) => (b[1].income - b[1].expense) - (a[1].income - a[1].expense)).slice(0, 10), [months]);

  // ===== Financial Independence (months covered) =====
  const avgMonthlyExpense = totalExpense / monthCount;
  const monthsCovered = avgMonthlyExpense > 0 ? net / avgMonthlyExpense : 0;
  const fiTone = monthsCovered >= 6 ? "income" : monthsCovered >= 3 ? "warn" : "expense";
  const fiLabel = monthsCovered >= 6 ? "ممتاز — احتياطي قوي" : monthsCovered >= 3 ? "جيد — استمر بالتوفير" : monthsCovered >= 1 ? "ضعيف — احتياطي محدود" : "خطر — لا يوجد احتياطي";

  // ===== Category compare between two months =====
  const allMonthsKeys = useMemo(() => {
    const s = new Set<string>();
    (txs ?? []).forEach(t => s.add(t.month_year));
    return Array.from(s).sort();
  }, [txs]);
  const allCategories = useMemo(() => {
    const s = new Set<string>();
    (txs ?? []).filter(t => t.type === "expense").forEach(t => s.add(t.category ?? "أخرى"));
    return Array.from(s).sort();
  }, [txs]);
  const [catCmpCategory, setCatCmpCategory] = useState<string>("");
  const [catCmpMonthA, setCatCmpMonthA] = useState<string>("");
  const [catCmpMonthB, setCatCmpMonthB] = useState<string>("");
  useMemo(() => {
    if (allCategories.length && !catCmpCategory) setCatCmpCategory(allCategories[0]);
    if (allMonthsKeys.length >= 2 && !catCmpMonthA) {
      setCatCmpMonthA(allMonthsKeys[allMonthsKeys.length - 2]);
      setCatCmpMonthB(allMonthsKeys[allMonthsKeys.length - 1]);
    }
  }, [allCategories, allMonthsKeys, catCmpCategory, catCmpMonthA]);
  const catCmp = useMemo(() => {
    if (!txs || !catCmpCategory || !catCmpMonthA || !catCmpMonthB) return null;
    const sumFor = (m: string) => {
      const rows = txs.filter(t => t.type === "expense" && t.month_year === m && (t.category ?? "أخرى") === catCmpCategory);
      const total = rows.reduce((s, t) => s + Number(t.amount), 0);
      return { total, count: rows.length, rows };
    };
    const a = sumFor(catCmpMonthA);
    const b = sumFor(catCmpMonthB);
    const diff = b.total - a.total;
    const pct = a.total !== 0 ? (diff / Math.abs(a.total)) * 100 : 0;
    return { a, b, diff, pct };
  }, [txs, catCmpCategory, catCmpMonthA, catCmpMonthB]);

  // yearly summary across all data
  const yearMap = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>();
    (txs ?? []).forEach(t => {
      const y = t.month_year.slice(0, 4);
      const v = m.get(y) ?? { income: 0, expense: 0 };
      if (t.type === "income") v.income += Number(t.amount); else v.expense += Number(t.amount);
      m.set(y, v);
    });
    return Array.from(m.entries()).sort();
  }, [txs]);
  const bestYear = useMemo(() => [...yearMap].sort((a, b) => (b[1].income - b[1].expense) - (a[1].income - a[1].expense))[0], [yearMap]);

  // compare mode data
  const compareData = useMemo(() => {
    if (mode !== "compare" || !yearA || !yearB) return null;
    const build = (y: string) => {
      const arr = Array.from({ length: 12 }, (_, i) => ({ m: String(i + 1).padStart(2, "0"), income: 0, expense: 0 }));
      (txs ?? []).filter(t => t.month_year.startsWith(y)).forEach(t => {
        const i = parseInt(t.month_year.slice(5, 7), 10) - 1;
        if (t.type === "income") arr[i].income += Number(t.amount); else arr[i].expense += Number(t.amount);
      });
      return arr;
    };
    const a = build(yearA), b = build(yearB);
    const chart = a.map((row, i) => ({
      month: row.m,
      [`صافي ${yearA}`]: row.income - row.expense,
      [`صافي ${yearB}`]: b[i].income - b[i].expense,
    }));
    const sum = (arr: typeof a) => arr.reduce((s, r) => ({ income: s.income + r.income, expense: s.expense + r.expense }), { income: 0, expense: 0 });
    return { chart, a: sum(a), b: sum(b) };
  }, [mode, yearA, yearB, txs]);

  const monthBarData = months.slice(-12).map(([m, v]) => ({ month: formatMonthLabel(m).split(" ")[0].slice(0, 3), ...v }));
  const pieData = catData.slice(0, 8).map(({ name, value }) => ({ name, value }));

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-1">التقارير المالية</h1>
      <p className="text-xs text-muted-foreground mb-4">تحليل شامل لجميع بياناتك</p>

      <Link to="/compare" className="mb-4 block rounded-3xl bg-primary/10 border border-primary/30 p-3 text-sm font-bold text-primary flex items-center justify-between">
        <span className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> مقارنة بين شهرين</span>
        <span className="text-xs opacity-80">افتح →</span>
      </Link>

      {bestYear && (
        <section className="rounded-3xl bg-income/15 border border-income/30 p-4 mb-4 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-income shrink-0" />
          <div>
            <div className="text-sm font-bold text-income">أفضل سنة مالية</div>
            <div className="text-xs text-muted-foreground">سنة <b className="text-foreground">{bestYear[0]}</b> بصافي أرباح <b className="text-foreground">{formatAmount(bestYear[1].income - bestYear[1].expense)} {CURRENCY}</b></div>
          </div>
        </section>
      )}

      <section className="bg-card border border-border rounded-3xl p-4 mb-4 space-y-3">
        <h2 className="text-sm font-bold">نطاق التقرير</h2>
        <div className="flex gap-2 text-xs flex-wrap">
          <ModeBtn active={mode === "all"} onClick={() => setMode("all")}>جميع البيانات</ModeBtn>
          <ModeBtn active={mode === "year"} onClick={() => setMode("year")}>سنة محددة</ModeBtn>
          <ModeBtn active={mode === "compare"} onClick={() => setMode("compare")}>مقارنة سنتين</ModeBtn>
        </div>
        {mode === "year" && (
          <select value={year} onChange={e => setYear(e.target.value)} className="w-full bg-muted/50 border border-border rounded-2xl px-3 py-2.5 text-sm outline-none">
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {mode === "compare" && (
          <div className="grid grid-cols-2 gap-2">
            <select value={yearA} onChange={e => setYearA(e.target.value)} className="bg-muted/50 border border-border rounded-2xl px-3 py-2.5 text-sm outline-none">
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={yearB} onChange={e => setYearB(e.target.value)} className="bg-muted/50 border border-border rounded-2xl px-3 py-2.5 text-sm outline-none">
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2 mb-3">
        <Kpi label="إجمالي الإيرادات" value={totalIncome} tone="income" />
        <Kpi label="إجمالي المصروفات" value={totalExpense} tone="expense" />
        <Kpi label="صافي الأرباح" value={net} tone={net >= 0 ? "income" : "expense"} />
      </section>

      <section className="mb-4">
        <HealthScore transactions={txs ?? []} />
      </section>

      <ZakatHawl transactions={txs ?? []} />

      <section className="grid grid-cols-3 gap-2 mb-4">
        <Kpi label="متوسط الدخل الشهري" value={totalIncome / monthCount} tone="income" small />
        <Kpi label="متوسط المصروف الشهري" value={totalExpense / monthCount} tone="expense" small />
        <Kpi label="متوسط التوفير الشهري" value={net / monthCount} tone={net >= 0 ? "income" : "expense"} small icon={<PiggyBank className="h-3 w-3" />} />
      </section>

      <section className="bg-card border border-border rounded-3xl p-4 mb-4">
        <h2 className="text-sm font-bold mb-3">الملخص السنوي</h2>
        <ul className="space-y-2">
          {yearMap.map(([y, v]) => (
            <li key={y} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 flex-wrap gap-2">
              <div className="font-bold">{y}</div>
              <div className="flex gap-3 text-xs items-center">
                <span className="text-income">+{formatAmount(v.income)}</span>
                <span className="text-expense">−{formatAmount(v.expense)}</span>
                <span className={`font-bold ${v.income - v.expense >= 0 ? "text-income" : "text-expense"}`}>= {formatAmount(v.income - v.expense)} {CURRENCY}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <AiInsights
        scope={mode === "year" ? "year" : "all"}
        label={mode === "year" ? year : "كامل البيانات"}
        transactions={filtered}
      />

      {compareData && (
        <section className="bg-card border border-border rounded-3xl p-4 mb-4">
          <h2 className="text-sm font-bold mb-3">مقارنة سنوية: {yearA} مقابل {yearB}</h2>
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <CompareCard year={yearA} income={compareData.a.income} expense={compareData.a.expense} />
            <CompareCard year={yearB} income={compareData.b.income} expense={compareData.b.expense} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compareData.chart}>
                <CartesianGrid stroke="oklch(0.32 0.014 50)" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "currentColor" }} />
                <YAxis tick={{ fontSize: 10, fill: "currentColor" }} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.014 50)", border: "1px solid oklch(0.32 0.014 50)", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey={`صافي ${yearA}`} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey={`صافي ${yearB}`} stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="bg-card border border-border rounded-3xl p-4 mb-4">
        <h2 className="text-sm font-bold mb-3">آخر 12 شهر</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthBarData}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "currentColor" }} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.014 50)", border: "1px solid oklch(0.32 0.014 50)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="income" fill="oklch(0.72 0.16 155)" radius={[6,6,0,0]} />
              <Bar dataKey="expense" fill="oklch(0.66 0.20 25)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <CollapsibleCard title="تحليل المصاريف حسب التصنيف">
        <section className="bg-card border border-border rounded-3xl p-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.22 0.014 50)", border: "1px solid oklch(0.32 0.014 50)", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {catData.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between bg-muted/20 rounded-xl px-2 py-1.5">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">{p.pct.toFixed(2)}%</span>
                  <span className="font-bold">{formatAmount(p.value)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </CollapsibleCard>

      <CollapsibleCard title="المصاريف المتكررة (أعلى 10)" icon={<Repeat className="h-4 w-4 text-primary" />}>
        <section className="bg-card border border-border rounded-3xl p-4">
          <div className="flex gap-2 text-xs mb-3">
            <ModeBtn active={recurringSort === "total"} onClick={() => setRecurringSort("total")}>حسب المبلغ</ModeBtn>
            <ModeBtn active={recurringSort === "count"} onClick={() => setRecurringSort("count")}>حسب التكرار</ModeBtn>
          </div>
          <ul className="space-y-1.5">
            {recurring.map(r => (
              <li key={r.desc} className="flex items-center justify-between bg-muted/20 rounded-xl px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.desc}</div>
                  <div className="text-[10px] text-muted-foreground">متوسط {formatAmount(r.avg)} · {r.count} مرات</div>
                </div>
                <div className="font-bold text-expense shrink-0">{formatAmount(r.total)}</div>
              </li>
            ))}
            {!recurring.length && <li className="text-center text-muted-foreground text-xs py-4">لا يوجد</li>}
          </ul>
        </section>
      </CollapsibleCard>

      <CollapsibleCard title="أعلى 10 إيرادات فردية" icon={<ArrowDownLeft className="h-4 w-4" />}>
        <TopList items={topIncomes} tone="income" />
      </CollapsibleCard>

      <CollapsibleCard title="أكبر 10 مصروفات فردية" icon={<ArrowUpRight className="h-4 w-4" />}>
        <TopList items={topExpenses} tone="expense" />
      </CollapsibleCard>

      <CollapsibleCard title="أفضل 10 أشهر في التوفير" icon={<TrendingUp className="h-4 w-4 text-income" />}>
        <MonthsList months={bestSavings} metric="net" />
      </CollapsibleCard>

      <CollapsibleCard title="أسوأ 10 أشهر في المصروفات" icon={<TrendingDown className="h-4 w-4 text-expense" />}>
        <MonthsList months={worstMonths} metric="expense" />
      </CollapsibleCard>

      <CollapsibleCard title="الاستقلال المالي" icon={<Shield className="h-4 w-4 text-primary" />}>
        <section className="bg-card border border-border rounded-3xl p-4">
          <div className="text-center mb-3">
            <div className="text-[11px] text-muted-foreground">رصيدك الحالي يغطي مصاريفك لمدة</div>
            <div className={`text-4xl font-extrabold my-2 ${fiTone === "income" ? "text-income" : fiTone === "warn" ? "text-yellow-500" : "text-expense"}`}>
              {monthsCovered > 0 ? monthsCovered.toFixed(1) : "0"}
            </div>
            <div className="text-xs text-muted-foreground">شهر بدون أي دخل إضافي</div>
          </div>
          <div className={`text-center text-xs font-bold p-2 rounded-2xl mb-3 ${fiTone === "income" ? "bg-income/10 text-income" : fiTone === "warn" ? "bg-yellow-500/10 text-yellow-500" : "bg-expense/10 text-expense"}`}>
            {fiLabel}
          </div>
          <ul className="space-y-1.5 text-xs">
            <li className="flex justify-between bg-muted/20 rounded-xl px-3 py-2">
              <span className="text-muted-foreground">صافي النقد (إيرادات − مصروفات)</span>
              <span className={`font-bold ${net >= 0 ? "text-income" : "text-expense"}`}>{formatAmount(net)} {CURRENCY}</span>
            </li>
            <li className="flex justify-between bg-muted/20 rounded-xl px-3 py-2">
              <span className="text-muted-foreground">متوسط المصروف الشهري</span>
              <span className="font-bold">{formatAmount(avgMonthlyExpense)} {CURRENCY}</span>
            </li>
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] text-center">
            <div className="bg-expense/10 text-expense rounded-xl p-2"><div className="font-bold">{"< 3"}</div><div>خطر</div></div>
            <div className="bg-yellow-500/10 text-yellow-500 rounded-xl p-2"><div className="font-bold">3-6</div><div>جيد</div></div>
            <div className="bg-income/10 text-income rounded-xl p-2"><div className="font-bold">{"6+"}</div><div>ممتاز</div></div>
          </div>
        </section>
      </CollapsibleCard>

      <CollapsibleCard title="مقارنة فئة بين شهرين" icon={<Layers className="h-4 w-4 text-primary" />}>
        <section className="bg-card border border-border rounded-3xl p-4 space-y-3">
          <div>
            <span className="text-[11px] text-muted-foreground">التصنيف</span>
            <select value={catCmpCategory} onChange={e => setCatCmpCategory(e.target.value)} className="mt-1 w-full bg-muted/50 border border-border rounded-2xl px-3 py-2.5 text-sm outline-none">
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] text-muted-foreground">الشهر الأول</span>
              <select value={catCmpMonthA} onChange={e => setCatCmpMonthA(e.target.value)} className="mt-1 w-full bg-muted/50 border border-border rounded-2xl px-3 py-2.5 text-sm outline-none">
                {allMonthsKeys.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">الشهر الثاني</span>
              <select value={catCmpMonthB} onChange={e => setCatCmpMonthB(e.target.value)} className="mt-1 w-full bg-muted/50 border border-border rounded-2xl px-3 py-2.5 text-sm outline-none">
                {allMonthsKeys.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
              </select>
            </label>
          </div>
          {catCmp && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/30 rounded-2xl p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">{formatMonthLabel(catCmpMonthA)}</div>
                  <div className="text-lg font-bold text-expense mt-1">{formatAmount(catCmp.a.total)}</div>
                  <div className="text-[10px] text-muted-foreground">{catCmp.a.count} معاملة</div>
                </div>
                <div className="bg-muted/30 rounded-2xl p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">{formatMonthLabel(catCmpMonthB)}</div>
                  <div className="text-lg font-bold text-expense mt-1">{formatAmount(catCmp.b.total)}</div>
                  <div className="text-[10px] text-muted-foreground">{catCmp.b.count} معاملة</div>
                </div>
              </div>
              <div className={`rounded-2xl p-3 text-center text-sm font-bold ${catCmp.diff > 0 ? "bg-expense/10 text-expense" : catCmp.diff < 0 ? "bg-income/10 text-income" : "bg-muted/30 text-muted-foreground"}`}>
                الفرق: {catCmp.diff > 0 ? "+" : ""}{formatAmount(catCmp.diff)} {CURRENCY}
                <span className="text-[11px] opacity-80 mr-1">({catCmp.pct > 0 ? "+" : ""}{catCmp.pct.toFixed(1)}%)</span>
              </div>
              {(catCmp.a.rows.length > 0 || catCmp.b.rows.length > 0) && (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <CatRows rows={catCmp.a.rows} />
                  <CatRows rows={catCmp.b.rows} />
                </div>
              )}
            </>
          )}
        </section>
      </CollapsibleCard>

      <section className="mb-4">
        <BackupButton />
        <Link to="/trash" className="mt-2 flex items-center justify-center gap-2 w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground hover:text-expense">
          <Trash2 className="h-4 w-4" /> سلة المحذوفات
        </Link>
      </section>
    </AppShell>
  );
}

function CollapsibleCard({ title, icon, defaultOpen = false, children }: { title: string; icon?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between bg-card border border-border rounded-3xl p-4 text-sm font-bold cursor-pointer">
        <span className="flex items-center gap-2">{icon}{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-3 py-2 rounded-xl border transition ${active ? "bg-brand-gradient text-primary-foreground border-transparent" : "bg-muted/40 border-border text-muted-foreground"}`}>{children}</button>;
}

function Kpi({ label, value, tone, small, icon }: { label: string; value: number; tone: "income" | "expense"; small?: boolean; icon?: React.ReactNode }) {
  const c = tone === "income" ? "text-income" : "text-expense";
  const bg = tone === "income" ? "bg-income/10 border-income/20" : "bg-expense/10 border-expense/20";
  return (
    <div className={`rounded-2xl border p-3 text-center ${bg}`}>
      <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">{icon}{label}</div>
      <div className={`mt-1 font-bold ${c} ${small ? "text-xs" : "text-sm"}`}>{formatAmount(value)}</div>
      <div className="text-[9px] text-muted-foreground">{CURRENCY}</div>
    </div>
  );
}

function CompareCard({ year, income, expense }: { year: string; income: number; expense: number }) {
  const net = income - expense;
  return (
    <div className="bg-muted/30 rounded-2xl p-3">
      <div className="font-bold text-sm mb-1">{year}</div>
      <div className="text-[11px] flex justify-between"><span>إيرادات</span><span className="text-income">+{formatAmount(income)}</span></div>
      <div className="text-[11px] flex justify-between"><span>مصاريف</span><span className="text-expense">−{formatAmount(expense)}</span></div>
      <div className="text-[11px] flex justify-between border-t border-border mt-1 pt-1"><span>الصافي</span><span className={`font-bold ${net >= 0 ? "text-income" : "text-expense"}`}>{formatAmount(net)}</span></div>
    </div>
  );
}

function CatRows({ rows }: { rows: Tx[] }) {
  if (!rows.length) return <div className="bg-muted/20 rounded-xl px-2 py-2 text-center text-muted-foreground">لا يوجد</div>;
  return (
    <ul className="space-y-1">
      {rows.map(r => (
        <li key={r.id} className="bg-muted/20 rounded-xl px-2 py-1.5 flex justify-between gap-2">
          <span className="truncate">{r.description}</span>
          <span className="font-bold text-expense shrink-0">{formatAmount(Number(r.amount))}</span>
        </li>
      ))}
    </ul>
  );
}

function TopList({ title, items, tone, icon }: { title?: string; items: Tx[]; tone: "income" | "expense"; icon?: React.ReactNode }) {
  const c = tone === "income" ? "text-income" : "text-expense";
  return (
    <div className="bg-card border border-border rounded-3xl p-4">
      {title && <h2 className="text-sm font-bold mb-3 flex items-center gap-2">{icon}{title}</h2>}
      <ul className="space-y-1.5">
        {items.map(t => (
          <li key={t.id} className="flex items-center justify-between bg-muted/20 rounded-xl px-3 py-2 text-xs">
            <div className="min-w-0">
              <div className="font-medium truncate">{t.description}</div>
              <div className="text-[10px] text-muted-foreground">{formatMonthLabel(t.month_year)} · {t.category}</div>
            </div>
            <div className={`font-bold shrink-0 ${c}`}>{formatAmount(Number(t.amount))}</div>
          </li>
        ))}
        {!items.length && <li className="text-center text-muted-foreground text-xs py-4">لا يوجد</li>}
      </ul>
    </div>
  );
}

function MonthsList({ title, months, metric, icon }: { title?: string; months: [string, { income: number; expense: number }][]; metric: "net" | "expense"; icon?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-3xl p-4">
      {title && <h2 className="text-sm font-bold mb-3 flex items-center gap-2">{icon}{title}</h2>}
      <ul className="space-y-1.5">
        {months.map(([m, v]) => {
          const val = metric === "net" ? v.income - v.expense : v.expense;
          const tone = metric === "expense" ? "text-expense" : val >= 0 ? "text-income" : "text-expense";
          return (
            <li key={m} className="flex items-center justify-between bg-muted/20 rounded-xl px-3 py-2 text-xs">
              <span className="font-medium">{formatMonthLabel(m)}</span>
              <span className={`font-bold ${tone}`}>{formatAmount(val)} {CURRENCY}</span>
            </li>
          );
        })}
        {!months.length && <li className="text-center text-muted-foreground text-xs py-4">لا يوجد</li>}
      </ul>
    </div>
  );
}
