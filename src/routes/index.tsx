import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { CURRENCY, currentMonthYear, fetchAllTransactions, formatAmount, formatMonthLabel, type Tx } from "@/lib/finance";
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Wallet, Calendar, Gem, Pencil, HandCoins } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { refreshGoldPrices } from "@/lib/gold.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const qc = useQueryClient();
  const { data: txs } = useQuery({
    queryKey: ["transactions", "all"],
    queryFn: fetchAllTransactions,
  });

  const refresh = useServerFn(refreshGoldPrices);
  const { data: assets } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("quantity, purchase_price_total").is("deleted_at", null);
      return data ?? [];
    },
  });
  const { data: openingBalance } = useQuery({
    queryKey: ["opening_balance"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("app_settings").select("value").eq("key", "opening_balance").maybeSingle();
      return Number(data?.value ?? 0);
    },
  });
  const { data: goldPrice } = useQuery({
    queryKey: ["gold_price"],
    queryFn: async () => {
      const { data } = await supabase.from("gold_prices").select("*").eq("asset_type", "gold_english_pound").maybeSingle();
      if (data) return { sell: Number(data.sell_price), buy: Number(data.buy_price) };
      const p = await refresh({ data: {} });
      return { sell: p.sell, buy: p.buy };
    },
    staleTime: 30 * 60 * 1000,
  });

  const goldQty = (assets ?? []).reduce((s, a: any) => s + Number(a.quantity), 0);
  const goldValue = goldPrice ? goldQty * goldPrice.sell : 0;
  const goldCost = (assets ?? []).reduce((s, a: any) => s + Number(a.purchase_price_total), 0);
  const goldPnl = goldValue - goldCost;

  const totalIncome = txs?.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const totalExpense = txs?.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const opening = Number(openingBalance ?? 0);
  const cashWealth = opening + totalIncome - totalExpense;
  // تكلفة الذهب لم تُسجَّل كمصروف، لذلك نخصمها من النقد ثم نضيف قيمة الذهب الحالية
  const wealth = cashWealth - goldCost + goldValue;

  const cm = currentMonthYear();
  const monthTxs = txs?.filter(t => t.month_year === cm) ?? [];
  const mIncome = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const mExpense = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const latest = txs?.slice().sort((a, b) => b.id - a.id).slice(0, 8) ?? [];

  // الزكاة: 2.5% من النقد + 2.5% من قيمة الذهب الحالية
  const ZAKAT_RATE = 0.025;
  const zakatCash = Math.max(0, cashWealth - goldCost) * ZAKAT_RATE;
  const zakatGold = goldValue * ZAKAT_RATE;
  const zakatTotal = zakatCash + zakatGold;

  return (
    <AppShell>
      <section className="rounded-3xl bg-brand-gradient p-6 shadow-glow text-primary-foreground">
        <div className="flex items-center gap-2 text-sm/none opacity-90">
          <Wallet className="h-4 w-4" />
          <span>الثروة الإجمالية</span>
        </div>
        <div className="mt-3 text-4xl font-black tracking-tight">
          {formatAmount(wealth)} <span className="text-xl font-bold opacity-90">{CURRENCY}</span>
        </div>
        <div className="mt-1 text-xs opacity-80">رصيد افتتاحي + النقد − تكلفة الذهب + قيمته اليوم</div>

        <div className="mt-3 flex items-center justify-between rounded-2xl bg-black/15 backdrop-blur p-3">
          <div>
            <div className="text-[11px] opacity-85">النقد الحالي (رصيد + معاملات)</div>
            <div className="mt-1 text-lg font-bold">{formatAmount(cashWealth)}</div>
          </div>
          <OpeningBalanceEditor value={opening} onSaved={() => qc.invalidateQueries({ queryKey: ["opening_balance"] })} />
        </div>

        <div className="mt-3 rounded-2xl bg-black/15 backdrop-blur p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] opacity-85">
              <HandCoins className="h-3 w-3" /> الزكاة السنوية (2.5%)
            </div>
            <div className="text-lg font-bold">{formatAmount(zakatTotal)}</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] opacity-85">
            <div className="flex items-center justify-between rounded-xl bg-black/15 px-2 py-1">
              <span>زكاة النقد</span>
              <span className="font-bold">{formatAmount(zakatCash)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-black/15 px-2 py-1">
              <span>زكاة الذهب</span>
              <span className="font-bold">{formatAmount(zakatGold)}</span>
            </div>
          </div>
        </div>

        {goldQty > 0 && (
          <Link to="/assets" className="mt-3 flex items-center justify-between rounded-2xl bg-black/20 backdrop-blur p-3">
            <div className="flex items-center gap-2 text-[11px] opacity-90">
              <Gem className="h-3 w-3" /> الذهب ({goldQty} ليرة)
            </div>
            <div className="text-sm font-bold">
              {formatAmount(goldValue)}
              <span className={`mr-2 text-[10px] ${goldPnl >= 0 ? "text-income" : "text-expense"}`}>
                ({goldPnl >= 0 ? "+" : ""}{formatAmount(goldPnl)})
              </span>
            </div>
          </Link>
        )}
      </section>


      <section className="mt-5 rounded-3xl bg-card border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="font-bold">الشهر الحالي</h2>
          </div>
          <span className="text-xs text-muted-foreground">{formatMonthLabel(cm)}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="مدخول" value={mIncome} tone="income" />
          <Stat label="مصروف" value={mExpense} tone="expense" />
          <Stat label="ربح" value={mIncome - mExpense} tone={mIncome - mExpense >= 0 ? "income" : "expense"} />
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> آخر المعاملات</h2>
          <Link to="/months" className="text-xs text-primary">عرض الكل</Link>
        </div>
        <ul className="space-y-2">
          {latest.map(t => <TxRow key={t.id} t={t} />)}
          {!latest.length && <li className="text-center text-sm text-muted-foreground py-8">لا توجد معاملات بعد</li>}
        </ul>
      </section>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" }) {
  const color = tone === "income" ? "text-income" : "text-expense";
  return (
    <div className="rounded-2xl bg-muted/50 border border-border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-bold ${color}`}>{formatAmount(value)}</div>
    </div>
  );
}

export function TxRow({ t }: { t: Tx }) {
  const income = t.type === "income";
  return (
    <li className="flex items-center justify-between bg-card border border-border rounded-2xl p-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${income ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
          {income ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{t.description}</div>
          <div className="text-[11px] text-muted-foreground">{t.category} · {formatMonthLabel(t.month_year)}</div>
        </div>
      </div>
      <div className={`text-sm font-bold ${income ? "text-income" : "text-expense"}`}>
        {income ? "+" : "−"}{formatAmount(Number(t.amount))}
      </div>
    </li>
  );
}

function OpeningBalanceEditor({ value, onSaved }: { value: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(value));
  const save = async () => {
    const num = Number(v);
    if (!Number.isFinite(num)) {
      toast.error("رقم غير صالح");
      return;
    }
    const { error } = await (supabase as any)
      .from("app_settings")
      .upsert({ key: "opening_balance", value: num, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) {
      toast.error("فشل الحفظ: " + error.message);
      return;
    }
    toast.success("تم حفظ الرصيد الافتتاحي");
    setOpen(false);
    onSaved();
  };
  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-black/20 gap-1" onClick={() => { setV(String(value)); setOpen(true); }}>
        <Pencil className="h-3 w-3" />
        تعديل
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input
        value={v}
        onChange={e => setV(e.target.value)}
        inputMode="decimal"
        className="h-8 w-24 text-foreground"
      />
      <Button size="sm" onClick={save} className="h-8">حفظ</Button>
      <Button size="sm" variant="ghost" className="h-8 text-primary-foreground" onClick={() => setOpen(false)}>إلغاء</Button>
    </div>
  );
}
