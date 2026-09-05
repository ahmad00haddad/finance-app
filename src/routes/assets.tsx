import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Gem, Pencil, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatAmount, CURRENCY } from "@/lib/finance";
import { refreshGoldPrices } from "@/lib/gold.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/assets")({ component: AssetsPage });

type Asset = {
  id: number;
  asset_type: string;
  description: string;
  quantity: number;
  purchase_price_total: number;
  purchase_date: string;
  note: string | null;
};

type Price = { buy: number; sell: number; updated_at: string; cached: boolean };

async function fetchAssets(): Promise<Asset[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .is("deleted_at", null)
    .order("purchase_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Asset[];
}

async function fetchCachedPrice(): Promise<Price | null> {
  const { data } = await supabase
    .from("gold_prices")
    .select("*")
    .eq("asset_type", "gold_english_pound")
    .maybeSingle();
  if (!data) return null;
  return {
    buy: Number(data.buy_price),
    sell: Number(data.sell_price),
    updated_at: data.updated_at as string,
    cached: true,
  };
}

function AssetsPage() {
  const qc = useQueryClient();
  const refresh = useServerFn(refreshGoldPrices);

  const { data: assets } = useQuery({ queryKey: ["assets"], queryFn: fetchAssets });
  const { data: price } = useQuery({
    queryKey: ["gold_price"],
    queryFn: async () => (await fetchCachedPrice()) ?? (await refresh({ data: {} })),
    staleTime: 5 * 60 * 1000,
  });

  const refreshMut = useMutation({
    mutationFn: () => refresh({ data: { force: true } }),
    onSuccess: (p) => {
      qc.setQueryData(["gold_price"], p);
      toast.success("تم تحديث سعر الذهب");
    },
    onError: (e: Error) => toast.error(e.message || "فشل التحديث"),
  });

  const [editPrice, setEditPrice] = useState(false);

  const total = (assets ?? []).reduce(
    (acc, a) => {
      const todayBuy = price ? price.buy * Number(a.quantity) : 0;
      const todaySell = price ? price.sell * Number(a.quantity) : 0;
      acc.cost += Number(a.purchase_price_total);
      acc.todayBuy += todayBuy;
      acc.todaySell += todaySell;
      acc.qty += Number(a.quantity);
      return acc;
    },
    { cost: 0, todayBuy: 0, todaySell: 0, qty: 0 },
  );
  const pnl = total.todaySell - total.cost;

  return (
    <AppShell>
      <section className="rounded-3xl bg-brand-gradient p-5 shadow-glow text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gem className="h-5 w-5" />
            <h1 className="font-bold">ممتلكاتي من الذهب</h1>
          </div>
          <button
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
            className="text-xs flex items-center gap-1 bg-black/20 px-2 py-1 rounded-lg"
          >
            <RefreshCw className={`h-3 w-3 ${refreshMut.isPending ? "animate-spin" : ""}`} />
            تحديث السعر
          </button>
        </div>
        <div className="mt-3 text-xs opacity-90">
          {total.qty} ليرة انجليزي · سعر اليوم:{" "}
          {price ? (
            <>شراء <b>{formatAmount(price.buy)}</b> · بيع <b>{formatAmount(price.sell)}</b></>
          ) : "—"}
          <button onClick={() => setEditPrice(true)} className="mr-2 underline opacity-90">تعديل</button>
        </div>
        {price && (
          <div className="mt-1 text-[10px] opacity-70">
            آخر تحديث: {new Date(price.updated_at).toLocaleString("ar")}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="التكلفة" value={total.cost} />
          <Stat label="قيمة اليوم (بيع)" value={total.todaySell} />
          <Stat label="الربح/الخسارة" value={pnl} tone={pnl >= 0 ? "up" : "down"} />
        </div>
      </section>

      {editPrice && price && (
        <EditPriceForm price={price} onClose={() => setEditPrice(false)} />
      )}

      <AddAssetForm />

      <ul className="mt-4 space-y-3">
        {(assets ?? []).map((a) => (
          <AssetRow key={a.id} asset={a} price={price ?? null} />
        ))}
        {assets && assets.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-8">لا توجد ممتلكات بعد</li>
        )}
      </ul>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "up" | "down" }) {
  const c = tone === "up" ? "text-income" : tone === "down" ? "text-expense" : "";
  return (
    <div className="rounded-2xl bg-black/15 backdrop-blur p-2">
      <div className="text-[10px] opacity-85">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${c}`}>{formatAmount(value)}</div>
    </div>
  );
}

function AssetRow({ asset, price }: { asset: Asset; price: Price | null }) {
  const qc = useQueryClient();
  const qty = Number(asset.quantity);
  const cost = Number(asset.purchase_price_total);
  const todayBuy = price ? price.buy * qty : 0;
  const todaySell = price ? price.sell * qty : 0;
  const diff = todaySell - cost;
  const up = diff >= 0;
  const [editing, setEditing] = useState(false);

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assets").update({ deleted_at: new Date().toISOString() } as any).eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("نُقلت إلى سلة المحذوفات");
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  if (editing) return <EditAssetForm asset={asset} onClose={() => setEditing(false)} />;

  return (
    <li className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">{asset.description}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {qty} قطعة · شراء {asset.purchase_date}
          </div>
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${up ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {up ? "+" : ""}{formatAmount(diff)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Cell label="سعر الشراء المسجل" value={cost} />
        <Cell label="سعر الشراء اليوم" value={todayBuy} />
        <Cell label="سعر البيع اليوم" value={todaySell} accent />
        <Cell label="الفرق عن الشراء" value={diff} accent tone={up ? "up" : "down"} />
      </div>

      <button
        onClick={() => del.mutate()}
        className="mt-3 text-xs text-muted-foreground hover:text-expense inline-flex items-center gap-1"
      >
        <Trash2 className="h-3 w-3" /> حذف
      </button>
      <button
        onClick={() => setEditing(true)}
        className="mt-3 mr-4 text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <Pencil className="h-3 w-3" /> تعديل
      </button>
    </li>
  );
}

function Cell({ label, value, accent, tone }: { label: string; value: number; accent?: boolean; tone?: "up" | "down" }) {
  const c = tone === "up" ? "text-income" : tone === "down" ? "text-expense" : accent ? "text-primary" : "";
  return (
    <div className="rounded-xl bg-muted/40 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-bold ${c}`}>{formatAmount(value)} <span className="text-[9px] opacity-60">{CURRENCY}</span></div>
    </div>
  );
}

function AddAssetForm() {
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const add = useMutation({
    mutationFn: async () => {
      if (!description.trim() || !price || !quantity) throw new Error("املأ جميع الحقول");
      const { error } = await supabase.from("assets").insert({
        asset_type: "gold_english_pound",
        description: description.trim(),
        quantity: Number(quantity),
        purchase_price_total: Number(price),
        purchase_date: date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      setDescription(""); setQuantity("1"); setPrice("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["assets"] });
      router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-2xl border-2 border-dashed border-border p-4 text-sm font-bold text-primary flex items-center justify-center gap-2 hover:bg-muted/30"
      >
        <Plus className="h-4 w-4" /> إضافة قطعة ذهب
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl bg-card border border-border p-4 space-y-3">
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="الوصف (مثال: ليرة انجليزي - الزعبي)"
        className="w-full rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="عدد القطع"
          className="rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="سعر الشراء الإجمالي"
          className="rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm"
        />
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => add.mutate()}
          disabled={add.isPending}
          className="flex-1 rounded-xl bg-brand-gradient text-primary-foreground font-bold py-2 text-sm shadow-glow"
        >
          {add.isPending ? "..." : "حفظ"}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 rounded-xl border border-border text-sm">إلغاء</button>
      </div>
    </div>
  );
}

function EditAssetForm({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(asset.description);
  const [quantity, setQuantity] = useState(String(asset.quantity));
  const [price, setPrice] = useState(String(asset.purchase_price_total));
  const [date, setDate] = useState(asset.purchase_date);

  const save = useMutation({
    mutationFn: async () => {
      if (!description.trim() || !price || !quantity) throw new Error("املأ جميع الحقول");
      const { error } = await supabase
        .from("assets")
        .update({
          description: description.trim(),
          quantity: Number(quantity),
          purchase_price_total: Number(price),
          purchase_date: date,
        })
        .eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["assets"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className="rounded-2xl bg-card border-2 border-primary p-4 space-y-3">
      <div className="text-xs font-bold text-primary">تعديل القطعة</div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="الوصف"
        className="w-full rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="العدد"
          className="rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm" />
        <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="سعر الشراء"
          className="rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm" />
      </div>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="flex-1 rounded-xl bg-brand-gradient text-primary-foreground font-bold py-2 text-sm shadow-glow">
          {save.isPending ? "..." : "حفظ"}
        </button>
        <button onClick={onClose} className="px-4 rounded-xl border border-border text-sm">إلغاء</button>
      </div>
    </li>
  );
}

function EditPriceForm({ price, onClose }: { price: Price; onClose: () => void }) {
  const qc = useQueryClient();
  const [buy, setBuy] = useState(String(price.buy));
  const [sell, setSell] = useState(String(price.sell));

  const save = useMutation({
    mutationFn: async () => {
      if (!buy || !sell) throw new Error("أدخل القيمتين");
      const { error } = await supabase
        .from("gold_prices")
        .update({
          buy_price: Number(buy),
          sell_price: Number(sell),
          source: "manual",
          updated_at: new Date().toISOString(),
        })
        .eq("asset_type", "gold_english_pound");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث السعر");
      qc.invalidateQueries({ queryKey: ["gold_price"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 rounded-2xl bg-card border-2 border-primary p-4 space-y-3">
      <div className="text-xs font-bold text-primary">تعديل سعر الذهب يدويًا (للقطعة الواحدة)</div>
      <p className="text-[11px] text-muted-foreground">
        يمكنك إدخال السعر من نقابة الصاغة الأردنية مباشرةً لتعكس السوق المحلي بدقة.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          سعر الشراء (للقطعة)
          <input type="number" step="0.01" value={buy} onChange={(e) => setBuy(e.target.value)}
            className="mt-1 w-full rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm" />
        </label>
        <label className="text-xs">
          سعر البيع (للقطعة)
          <input type="number" step="0.01" value={sell} onChange={(e) => setSell(e.target.value)}
            className="mt-1 w-full rounded-xl bg-muted/40 border border-border px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="flex-1 rounded-xl bg-brand-gradient text-primary-foreground font-bold py-2 text-sm shadow-glow">
          {save.isPending ? "..." : "حفظ"}
        </button>
        <button onClick={onClose} className="px-4 rounded-xl border border-border text-sm">إلغاء</button>
      </div>
    </div>
  );
}