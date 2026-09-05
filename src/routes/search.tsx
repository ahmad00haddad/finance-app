import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CATEGORIES, CURRENCY, fetchAllTransactions, formatAmount, formatMonthLabel } from "@/lib/finance";
import { Search, SlidersHorizontal, ArrowDownLeft, ArrowUpRight, X, ChevronDown, ListFilter } from "lucide-react";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  head: () => ({
    meta: [
      { title: "البحث المتقدم | حساباتي الشاملة" },
      { name: "description", content: "ابحث في كل معاملاتك المالية بالوصف والتصنيف والنوع والمبلغ والفترة الزمنية مع ترتيب مرن للنتائج." },
      { property: "og:title", content: "البحث المتقدم | حساباتي الشاملة" },
      { property: "og:description", content: "بحث متقدم في جميع المعاملات المالية بفلاتر مرنة وملخص فوري للإيرادات والمصروفات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Sort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

const fieldClass =
  "w-full bg-muted/40 border border-border rounded-2xl px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:bg-muted/60";

function SearchPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [category, setCategory] = useState<string>("all");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");
  const [sort, setSort] = useState<Sort>("date_desc");
  const [showFilters, setShowFilters] = useState(false);

  const { data: all, isLoading } = useQuery({
    queryKey: ["transactions", "all-search"],
    queryFn: fetchAllTransactions,
  });

  const results = useMemo(() => {
    let r = (all ?? []).slice();
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      r = r.filter(t => t.description.toLowerCase().includes(k));
    }
    if (type !== "all") r = r.filter(t => t.type === type);
    if (category !== "all") r = r.filter(t => (t.category ?? "أخرى") === category);
    if (fromMonth) r = r.filter(t => t.month_year >= fromMonth);
    if (toMonth) r = r.filter(t => t.month_year <= toMonth);
    const mn = parseFloat(minAmt); if (!Number.isNaN(mn)) r = r.filter(t => Number(t.amount) >= mn);
    const mx = parseFloat(maxAmt); if (!Number.isNaN(mx)) r = r.filter(t => Number(t.amount) <= mx);
    r.sort((a, b) => {
      if (sort === "amount_desc") return Number(b.amount) - Number(a.amount);
      if (sort === "amount_asc") return Number(a.amount) - Number(b.amount);
      if (sort === "date_asc") return a.month_year.localeCompare(b.month_year) || a.id - b.id;
      return b.month_year.localeCompare(a.month_year) || b.id - a.id;
    });
    return r;
  }, [all, q, type, category, fromMonth, toMonth, minAmt, maxAmt, sort]);

  const totalIn = results.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalEx = results.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const net = totalIn - totalEx;

  const activeCount =
    (q.trim() ? 1 : 0) + (type !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0) +
    (fromMonth ? 1 : 0) + (toMonth ? 1 : 0) + (minAmt ? 1 : 0) + (maxAmt ? 1 : 0);

  const reset = () => {
    setQ(""); setType("all"); setCategory("all"); setFromMonth(""); setToMonth(""); setMinAmt(""); setMaxAmt(""); setSort("date_desc");
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">البحث المتقدم</h1>
          <p className="text-xs text-muted-foreground mt-0.5">ابحث في جميع السجلات بأي معيار</p>
        </div>
        {activeCount > 0 && (
          <button onClick={reset} className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 border border-border rounded-full px-2.5 py-1.5 active:scale-95 transition">
            <X className="h-3 w-3" /> مسح ({activeCount})
          </button>
        )}
      </div>

      <section className="bg-card border border-border rounded-3xl p-4 space-y-4 shadow-glow">
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="ابحث في الوصف..."
            autoComplete="off"
            className="w-full bg-muted/40 border border-border rounded-2xl pr-10 pl-9 py-3 text-sm outline-none transition focus:border-primary"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="مسح البحث" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground mb-1.5 block">نوع العملية</label>
          <div className="grid grid-cols-3 gap-1 bg-muted/40 border border-border rounded-2xl p-1">
            {([
              { v: "all", l: "الكل" },
              { v: "income", l: "إيرادات" },
              { v: "expense", l: "مصروفات" },
            ] as const).map(o => {
              const on = type === o.v;
              const tone = o.v === "income" ? "bg-income text-income-foreground" : o.v === "expense" ? "bg-expense text-expense-foreground" : "bg-primary text-primary-foreground";
              return (
                <button
                  key={o.v}
                  onClick={() => setType(o.v)}
                  className={`rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${on ? tone : "text-muted-foreground"}`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="التصنيف">
          <div className="relative">
            <select value={category} onChange={e => setCategory(e.target.value)} className={`${fieldClass} appearance-none pl-8`}>
              <option value="all">جميع التصنيفات</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </Field>

        <button
          onClick={() => setShowFilters(v => !v)}
          className="w-full flex items-center justify-between bg-muted/30 border border-border rounded-2xl px-3.5 py-3 text-xs font-medium active:scale-[.99] transition"
        >
          <span className="flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5" /> فلاتر التاريخ والمبلغ والترتيب</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Field label="من شهر"><input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)} className={fieldClass} /></Field>
            <Field label="إلى شهر"><input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)} className={fieldClass} /></Field>
            <Field label="أقل مبلغ"><input type="number" inputMode="decimal" placeholder="0" value={minAmt} onChange={e => setMinAmt(e.target.value)} className={fieldClass} /></Field>
            <Field label="أعلى مبلغ"><input type="number" inputMode="decimal" placeholder="∞" value={maxAmt} onChange={e => setMaxAmt(e.target.value)} className={fieldClass} /></Field>
            <div className="col-span-2">
              <Field label="ترتيب النتائج">
                <div className="relative">
                  <select value={sort} onChange={e => setSort(e.target.value as Sort)} className={`${fieldClass} appearance-none pl-8`}>
                    <option value="date_desc">التاريخ: الأحدث أولاً</option>
                    <option value="date_asc">التاريخ: الأقدم أولاً</option>
                    <option value="amount_desc">المبلغ: الأعلى أولاً</option>
                    <option value="amount_asc">المبلغ: الأقل أولاً</option>
                  </select>
                  <ListFilter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </Field>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2.5">
        <Stat label="عدد النتائج" value={results.length.toLocaleString("en-US")} />
        <Stat label="الصافي" value={formatAmount(net)} tone={net >= 0 ? "income" : "expense"} unit={CURRENCY} />
        <Stat label="مجموع الإيرادات" value={formatAmount(totalIn)} tone="income" unit={CURRENCY} />
        <Stat label="مجموع المصروفات" value={formatAmount(totalEx)} tone="expense" unit={CURRENCY} />
      </section>

      <section className="mt-4">
        {isLoading ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-16 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </ul>
        ) : results.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-3xl">
            <Search className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm text-muted-foreground">لا توجد نتائج مطابقة</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {results.slice(0, 300).map(t => {
              const inc = t.type === "income";
              return (
                <li key={t.id} className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3">
                  <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${inc ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
                    {inc ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.description}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{t.category ?? "أخرى"} · {formatMonthLabel(t.month_year)}</div>
                  </div>
                  <div className={`text-sm font-bold tabular-nums whitespace-nowrap ${inc ? "text-income" : "text-expense"}`}>
                    {inc ? "+" : "−"}{formatAmount(Number(t.amount))} <span className="text-[10px] opacity-70">{CURRENCY}</span>
                  </div>
                </li>
              );
            })}
            {results.length > 300 && <li className="text-center text-xs text-muted-foreground py-2">عرض أول 300 نتيجة من {results.length}</li>}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, tone, unit }: { label: string; value: string; tone?: "income" | "expense"; unit?: string }) {
  const c = tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-foreground";
  const ring = tone === "income" ? "bg-income/5 border-income/20" : tone === "expense" ? "bg-expense/5 border-expense/20" : "bg-card border-border";
  return (
    <div className={`rounded-2xl border p-3 ${ring}`}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-extrabold tabular-nums ${c}`}>
        {value}{unit && <span className="text-[10px] font-medium opacity-70"> {unit}</span>}
      </div>
    </div>
  );
}
