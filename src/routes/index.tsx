import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { CURRENCY, currentMonthYear, fetchAllTransactions, formatAmount, formatMonthLabel, type Tx } from "@/lib/finance";
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Wallet, Calendar, Gem, Pencil, HandCoins, ShoppingBag, Banknote } from "lucide-react";

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
  const wealth = cashWealth - goldCost + goldValue;

  const cm = currentMonthYear();
  const monthTxs = txs?.filter(t => t.month_year === cm) ?? [];
  const mIncome = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const mExpense = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const monthTotal = mIncome + mExpense || 1;
  const incomePct = Math.round((mIncome / monthTotal) * 100);
  const expensePct = Math.round((mExpense / monthTotal) * 100);

  const latest = txs?.slice().sort((a, b) => b.id - a.id).slice(0, 8) ?? [];

  const ZAKAT_RATE = 0.025;
  const zakatCash = Math.max(0, cashWealth - goldCost) * ZAKAT_RATE;
  const zakatGold = goldValue * ZAKAT_RATE;
  const zakatTotal = zakatCash + zakatGold;

  return (
    <AppShell>
      {/* Wealth Summary Card */}
      <section className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-gold-dark rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
        <div className="relative bg-card border border-primary/30 rounded-3xl p-6 overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              <span>إجمالي الثروة</span>
            </div>
            {goldPnl !== 0 && (
              <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] rounded border border-primary/20">
                {goldPnl >= 0 ? "+" : ""}{formatAmount(goldPnl)}
              </span>
            )}
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-bold text-foreground tracking-tight font-serif">
              <span className="text-primary text-xl ml-1">{CURRENCY}</span>
              {formatAmount(wealth)}
            </h2>
          </div>
          <div className="mt-8 flex items-center justify-between pt-6 border-t border-border text-xs text-muted-foreground">
            <span>النقد الحالي: <span className="text-foreground font-medium">{formatAmount(cashWealth)}</span></span>
            <OpeningBalanceEditor value={opening} onSaved={() => qc.invalidateQueries({ queryKey: ["opening_balance"] })} />
          </div>
        </div>
      </section>

      {/* Zakat Breakdown */}
      <section className="mt-8">
        <h3 className="text-foreground font-medium mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2"><HandCoins className="h-4 w-4 text-primary" /> حساب الزكاة</span>
          <span className="text-primary text-xs">(2.5%)</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary p-4 rounded-2xl border border-border">
            <p className="text-muted-foreground text-xs mb-1">المستحق الحالي</p>
            <p className="text-foreground font-semibold font-serif">{formatAmount(zakatTotal)} <span className="text-[10px] text-muted-foreground">{CURRENCY}</span></p>
          </div>
          <div className="bg-secondary p-4 rounded-2xl border border-border">
            <p className="text-muted-foreground text-xs mb-1">زكاة الذهب</p>
            <p className="text-foreground font-semibold font-serif">{formatAmount(zakatGold)}</p>
          </div>
        </div>
      </section>

      {/* Month Stats */}
      <section className="mt-8 bg-card rounded-3xl p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="font-medium">إحصائيات الشهر</h3>
          </div>
          <span className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">{formatMonthLabel(cm)}</span>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-primary rounded-full" />
              <div>
                <p className="text-muted-foreground text-xs">الدخل</p>
                <p className="text-foreground text-sm font-medium">{formatAmount(mIncome)} {CURRENCY}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-left">
              <div className="text-right">
                <p className="text-muted-foreground text-xs">المصروفات</p>
                <p className="text-foreground text-sm font-medium">{formatAmount(mExpense)} {CURRENCY}</p>
              </div>
              <div className="w-1.5 h-8 bg-muted rounded-full" />
            </div>
          </div>
          <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden flex">
            <div className="bg-primary h-full" style={{ width: `${incomePct}%` }} />
            <div className="bg-muted-foreground/40 h-full" style={{ width: `${expensePct}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center pt-2">
            <MiniStat label="مدخول" value={mIncome} tone="income" />
            <MiniStat label="مصروف" value={mExpense} tone="expense" />
            <MiniStat label="صافي" value={mIncome - mExpense} tone={mIncome - mExpense >= 0 ? "income" : "expense"} />
          </div>
        </div>
      </section>

      {/* Gold Section */}
      {goldQty > 0 && (
        <Link to="/assets" className="mt-8 block">
          <div className="bg-card rounded-3xl p-5 border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Gem className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">الذهب</p>
                <p className="text-[10px] text-muted-foreground">{goldQty} ليرة إنجليزية</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-foreground font-semibold font-serif">{formatAmount(goldValue)}</p>
              <p className={`text-[10px] ${goldPnl >= 0 ? "text-income" : "text-expense"}`}>
                {goldPnl >= 0 ? "+" : ""}{formatAmount(goldPnl)}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Latest Transactions */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> أحدث العمليات</h3>
          <Link to="/months" className="text-xs text-primary">الكل</Link>
        </div>
        <ul className="space-y-3">
          {latest.map(t => <TxRow key={t.id} t={t} />)}
          {!latest.length && <li className="text-center text-sm text-muted-foreground py-8">لا توجد معاملات بعد</li>}
        </ul>
      </section>
    </AppShell>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" }) {
  const color = tone === "income" ? "text-income" : "text-expense";
  return (
    <div className="rounded-2xl bg-secondary border border-border p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-bold ${color}`}>{formatAmount(value)}</div>
    </div>
  );
}

export function TxRow({ t }: { t: Tx }) {
  const income = t.type === "income";
  const Icon = income ? Banknote : ShoppingBag;
  return (
    <li className="flex items-center justify-between bg-card border border-border rounded-2xl p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border ${income ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary border-border text-muted-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{t.description}</div>
          <div className="text-[10px] text-muted-foreground">{t.category} · {formatMonthLabel(t.month_year)}</div>
        </div>
      </div>
      <div className={`text-sm font-bold ${income ? "text-primary" : "text-foreground"}`} dir="ltr">
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
      <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10 gap-1 h-8 px-2" onClick={() => { setV(String(value)); setOpen(true); }}>
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
        className="h-8 w-24 bg-secondary border-border"
      />
      <Button size="sm" onClick={save} className="h-8 bg-primary text-primary-foreground hover:bg-primary/90">حفظ</Button>
      <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:bg-secondary" onClick={() => setOpen(false)}>إلغاء</Button>
    </div>
  );
}
