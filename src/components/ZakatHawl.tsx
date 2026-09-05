import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Moon, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Sparkles, Loader2, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { zakatReductionAdvice } from "@/lib/ai.functions";
import { CURRENCY, formatAmount, type Tx } from "@/lib/finance";

const ZAKAT_RATE = 0.025;
// النصاب = 85 جرام ذهب خالص. الليرة الإنجليزية = 7.32238 جرام ذهب خالص
const NISAB_IN_SOVEREIGNS = 85 / 7.32238;

const hijriFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
});

function toHijri(d: Date) {
  const parts = hijriFmt.formatToParts(d);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** أول يوم من رمضان (شهر 9 هجري) لسنة هجرية معيّنة بالتقويم الميلادي */
function ramadanStart(hy: number): Date {
  // تقدير أولي لبداية رمضان ثم البحث عن اليوم الدقيق
  const approx = new Date(Date.UTC(622, 6, 19));
  approx.setUTCDate(approx.getUTCDate() + Math.round((hy - 1) * 354.367 + 8 * 29.53));
  // امشِ يومًا بيوم للعثور على 1 رمضان
  for (let i = -60; i <= 60; i++) {
    const d = new Date(approx.getTime() + i * 86400000);
    const h = toHijri(d);
    if (h.y === hy && h.m === 9 && h.d === 1) return d;
  }
  return approx;
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function ZakatHawl({ transactions }: { transactions: Tx[] }) {
  const [open, setOpen] = useState(false);

  const { data: assets } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("quantity, purchase_price_total, purchase_date").is("deleted_at", null);
      return data ?? [];
    },
  });
  const { data: opening } = useQuery({
    queryKey: ["opening_balance"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("app_settings").select("value").eq("key", "opening_balance").maybeSingle();
      return Number(data?.value ?? 0);
    },
  });
  const { data: goldPrice } = useQuery({
    queryKey: ["gold_price"],
    queryFn: async () => {
      const { data } = await supabase.from("gold_prices").select("sell_price").eq("asset_type", "gold_english_pound").maybeSingle();
      return data ? Number(data.sell_price) : 0;
    },
  });

  const today = new Date();
  const h = toHijri(today);
  const nextRamadan = useMemo(() => {
    const thisYear = ramadanStart(h.y);
    return thisYear.getTime() > today.getTime() ? thisYear : ramadanStart(h.y + 1);
  }, [h.y]);
  const daysToRamadan = Math.ceil((nextRamadan.getTime() - today.getTime()) / 86400000);

  // ===== الوضع الحالي (لخطة تحريك المال) =====
  const now = useMemo(() => {
    const sell = goldPrice ?? 0;
    const nisab = sell * NISAB_IN_SOVEREIGNS;
    const qty = (assets ?? []).reduce((s: number, a: any) => s + Number(a.quantity), 0);
    const cost = (assets ?? []).reduce((s: number, a: any) => s + Number(a.purchase_price_total), 0);
    const rawCash = Number(opening ?? 0) + transactions
      .reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
    const cash = Math.max(0, rawCash - cost);
    const goldValue = qty * sell;
    const total = cash + goldValue;
    const monthsSet = new Set(transactions.map(t => t.month_year));
    const mc = monthsSet.size || 1;
    const avgMonthlyIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0) / mc;
    const avgMonthlyExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0) / mc;
    const zakat = total >= nisab ? total * ZAKAT_RATE : 0;
    const emergency = avgMonthlyExpense * 6;
    const movable = Math.max(0, cash - emergency);
    return { cash, goldValue, total, nisab, zakat, avgMonthlyIncome, avgMonthlyExpense, emergency, movable };
  }, [transactions, assets, opening, goldPrice]);

  const adviceFn = useServerFn(zakatReductionAdvice);
  const [advice, setAdvice] = useState<string | null>(null);
  const adviceM = useMutation({
    mutationFn: () => adviceFn({ data: {
      cash: now.cash, goldValue: now.goldValue, total: now.total, zakat: now.zakat,
      nisab: now.nisab, avgMonthlyIncome: now.avgMonthlyIncome,
      avgMonthlyExpense: now.avgMonthlyExpense, daysToRamadan,
    } }),
    onSuccess: (r) => setAdvice(r.content),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    if (!transactions.length) return [];
    const sortedMonths = Array.from(new Set(transactions.map(t => t.month_year))).sort();
    const firstMonth = sortedMonths[0];
    const sell = goldPrice ?? 0;
    const nisab = sell * NISAB_IN_SOVEREIGNS;

    // زكاة مدفوعة فعليًا (من المعاملات)
    const paid = transactions.filter(t =>
      t.type === "expense" && ((t.category ?? "").includes("زكا") || t.description.includes("زكا"))
    );

    const out: {
      hy: number; date: Date; cash: number; goldValue: number; total: number;
      due: number; paidAmount: number; nisab: number;
    }[] = [];

    for (let hy = h.y; hy >= h.y - 6; hy--) {
      const date = ramadanStart(hy);
      if (date.getTime() > today.getTime()) continue;
      const mk = monthKey(date);
      if (mk < firstMonth) continue;

      const cash = Number(opening ?? 0) + transactions
        .filter(t => t.month_year <= mk)
        .reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);

      const owned = (assets ?? []).filter((a: any) => !a.purchase_date || a.purchase_date <= date.toISOString().slice(0, 10));
      const qty = owned.reduce((s: number, a: any) => s + Number(a.quantity), 0);
      const cost = owned.reduce((s: number, a: any) => s + Number(a.purchase_price_total), 0);
      const goldValue = qty * sell;

      // النقد لا يشمل ما دُفع في الذهب (لم يُسجَّل كمصروف)
      const cashAdj = Math.max(0, cash - cost);
      const total = cashAdj + goldValue;

      // الزكاة المدفوعة قرب هذا رمضان (±2 أشهر)
      const paidAmount = paid
        .filter(t => {
          const diff = monthsBetween(t.month_year, mk);
          return diff !== null && Math.abs(diff) <= 2;
        })
        .reduce((s, t) => s + Number(t.amount), 0);

      out.push({ hy, date, cash: cashAdj, goldValue, total, due: total >= nisab ? total * ZAKAT_RATE : 0, paidAmount, nisab });
    }
    return out;
  }, [transactions, assets, opening, goldPrice, h.y]);

  return (
    <section className="bg-card border border-border rounded-3xl mb-4 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">حَول الزكاة (التقويم الهجري)</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{h.d}/{h.m}/{h.y} هـ</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="rounded-2xl bg-primary/10 border border-primary/25 p-3 mb-3">
            <div className="text-[11px] text-muted-foreground">رمضان القادم (موعد زكاتك)</div>
            <div className="mt-1 text-sm font-bold">
              {nextRamadan.toISOString().slice(0, 10)} — بعد {daysToRamadan} يوم
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              الحَول الهجري = 354 يومًا، لذلك يتقدّم موعد رمضان ~11 يومًا كل سنة ميلادية.
            </div>
          </div>

          {!rows.length && <p className="text-xs text-muted-foreground text-center py-4">لا توجد بيانات كافية للحساب</p>}

          <ul className="space-y-2">
            {rows.map(r => {
              const diff = r.paidAmount - r.due;
              const ok = r.due === 0 || Math.abs(diff) <= r.due * 0.1;
              return (
                <li key={r.hy} className="rounded-2xl bg-muted/30 border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">رمضان {r.hy} هـ</span>
                    <span className="text-[11px] text-muted-foreground">{r.date.toISOString().slice(0, 10)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <Cell label="النقد التقديري" v={r.cash} />
                    <Cell label="قيمة الذهب" v={r.goldValue} />
                    <Cell label="إجمالي الوعاء الزكوي" v={r.total} />
                    <Cell label="الزكاة الواجبة (2.5%)" v={r.due} strong />
                    <Cell label="المدفوع فعليًا" v={r.paidAmount} />
                    <Cell label={diff >= 0 ? "زيادة" : "نقص"} v={Math.abs(diff)} tone={diff >= 0 ? "income" : "expense"} />
                  </div>
                  <div className={`mt-2 flex items-center gap-1 text-[11px] ${ok ? "text-income" : "text-expense"}`}>
                    {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {r.total < r.nisab
                      ? "الثروة كانت أقل من النصاب — لا زكاة واجبة"
                      : ok
                        ? "المبلغ المدفوع مطابق تقريبًا للواجب"
                        : diff < 0
                          ? `يبدو أن هنالك نقصًا بمقدار ${formatAmount(Math.abs(diff))} ${CURRENCY} — يُستحسن إخراجه`
                          : "دفعت أكثر من الواجب (نفل وصدقة)"}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">كيف أخفّف زكاتي بتحريك المال؟</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Cell label="وعاؤك الزكوي اليوم" v={now.total} />
              <Cell label="زكاة اليوم (2.5%)" v={now.zakat} strong />
              <Cell label="احتياطي 6 أشهر (يبقى نقدًا)" v={now.emergency} />
              <Cell label="القابل للتحريك/الاستثمار" v={now.movable} tone="income" />
            </div>

            <ul className="mt-3 space-y-1.5 text-[11px] text-muted-foreground leading-relaxed list-disc pr-4">
              <li><b className="text-foreground">لا تحايل:</b> الزكاة لا تُسقَط بنقل الملكية صوريًا قبل رمضان — لكنها تسقط عن الأصول المستخدمة أو المؤجَّرة حقيقة.</li>
              <li><b className="text-foreground">أرض أو عقار للاستخدام/الإيجار:</b> لا زكاة على أصله، فقط على صافي الإيجار الباقي عند الحول. كل {formatAmount(40000)} {CURRENCY} تنقلها من النقد إلى عقار تخفّض زكاتك ~{formatAmount(1000)} {CURRENCY} سنويًا.</li>
              <li><b className="text-foreground">أدوات عمل ومهارة:</b> معدات، حاسوب، سيارة عمل، دورات — لا زكاة عليها وتزيد دخلك.</li>
              <li><b className="text-foreground">مشروع أو شراكة:</b> رأس المال يصبح عروض تجارة تُزكّى على قيمتها، لكن الربح غالبًا يتجاوز 2.5% بكثير فتصبح الزكاة من الربح لا من رأس المال.</li>
              <li><b className="text-foreground">صدقة جارية/وقف:</b> ما تُخرجه وقفًا يزول عن ملكك فلا زكاة عليه، وأجره مستمر.</li>
              <li><b className="text-foreground">سدّ الديون:</b> الدَّين الحالّ عليك يُخصم من الوعاء عند كثير من الفقهاء — سدّه قبل رمضان أفضل من تأخيره.</li>
              <li><b className="text-foreground">ما لا يُعفى:</b> النقد، الذهب والليرات، الحسابات البنكية، وأي شيء مُشترى بنيّة البيع.</li>
            </ul>

            {!advice && !adviceM.isPending && (
              <button
                onClick={() => adviceM.mutate()}
                className="mt-3 w-full py-3 rounded-2xl bg-brand-gradient text-primary-foreground text-sm font-bold shadow-glow active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" /> اقترح لي خطة تحريك مالي (بأرقامي)
              </button>
            )}

            {adviceM.isPending && (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2 text-primary" />
                <p className="text-xs">جاري إعداد خطة مناسبة لك...</p>
              </div>
            )}

            {advice && (
              <div className="mt-3">
                <div className="prose prose-sm dark:prose-invert max-w-none text-[12px] leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_ul]:pr-4">
                  <ReactMarkdown>{advice}</ReactMarkdown>
                </div>
                <button
                  onClick={() => adviceM.mutate()}
                  disabled={adviceM.isPending}
                  className="mt-2 text-[11px] text-muted-foreground hover:text-primary"
                >
                  إعادة توليد الخطة
                </button>
              </div>
            )}

            <p className="mt-2 text-[10px] text-muted-foreground">
              هذه اقتراحات تنظيمية واستثمارية وليست فتوى — للتفاصيل راجع دار الإفتاء الأردنية.
            </p>
          </div>

          <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
            ملاحظة: النقد التقديري محسوب من الرصيد الافتتاحي + المعاملات حتى شهر رمضان، وقيمة الذهب محسوبة بسعر اليوم
            (لعدم توفر السعر التاريخي)، لذلك الأرقام السابقة تقديرية للمراجعة فقط. النصاب الحالي ≈ {formatAmount(rows[0]?.nisab ?? 0)} {CURRENCY}.
          </p>
        </div>
      )}
    </section>
  );
}

function Cell({ label, v, strong, tone }: { label: string; v: number; strong?: boolean; tone?: "income" | "expense" }) {
  const color = tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "";
  return (
    <div className="flex items-center justify-between rounded-xl bg-background/60 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? "font-black" : "font-bold"} ${color}`}>{formatAmount(v)}</span>
    </div>
  );
}

function monthsBetween(a: string, b: string): number | null {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (!ay || !am || !by || !bm) return null;
  return (ay - by) * 12 + (am - bm);
}
