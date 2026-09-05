import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { formatAmount, formatMonthLabel, CURRENCY } from "@/lib/finance";
import { ArrowRight, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/trash")({ component: TrashPage });

const RETENTION_DAYS = 7;

function daysLeft(deletedAt: string) {
  const d = new Date(deletedAt).getTime();
  const cutoff = d + RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((cutoff - Date.now()) / (24 * 60 * 60 * 1000)));
}

async function purgeExpired() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("transactions").delete().lt("deleted_at", cutoff);
  await supabase.from("assets").delete().lt("deleted_at", cutoff);
}

function TrashPage() {
  const qc = useQueryClient();

  useEffect(() => { purgeExpired().catch(() => {}); }, []);

  const { data: txs } = useQuery({
    queryKey: ["trash", "transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions").select("*").not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: assets } = useQuery({
    queryKey: ["trash", "assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets").select("*").not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const restoreTx = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("transactions").update({ deleted_at: null } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم الاسترجاع"); },
  });
  const purgeTx = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trash", "transactions"] }); toast.success("حُذفت نهائياً"); },
  });
  const restoreAsset = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("assets").update({ deleted_at: null } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم الاسترجاع"); },
  });
  const purgeAsset = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trash", "assets"] }); toast.success("حُذفت نهائياً"); },
  });

  const txList = txs ?? [];
  const assetList = assets ?? [];
  const empty = !txList.length && !assetList.length;

  return (
    <AppShell>
      <Toaster position="top-center" richColors />
      <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3"><ArrowRight className="h-4 w-4" /> العودة</Link>
      <h1 className="text-xl font-bold mb-1">سلة المحذوفات</h1>
      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> تُحذف العناصر نهائياً بعد {RETENTION_DAYS} أيام تلقائياً
      </p>

      {empty && <div className="text-center text-sm text-muted-foreground py-16">السلة فارغة</div>}

      {txList.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2 text-muted-foreground">المعاملات ({txList.length})</h2>
          <ul className="space-y-2">
            {txList.map((t: any) => {
              const left = daysLeft(t.deleted_at);
              const income = t.type === "income";
              return (
                <li key={t.id} className="bg-card border border-border rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{t.description}</div>
                      <div className="text-[11px] text-muted-foreground">{t.category} · {formatMonthLabel(t.month_year)}</div>
                    </div>
                    <div className={`text-sm font-bold shrink-0 ${income ? "text-income" : "text-expense"}`}>
                      {income ? "+" : "−"}{formatAmount(Number(t.amount))}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">تُحذف نهائياً خلال {left} يوم</span>
                    <div className="flex gap-2">
                      <button onClick={() => restoreTx.mutate(t.id)} className="text-xs flex items-center gap-1 text-primary hover:underline">
                        <RotateCcw className="h-3 w-3" /> استرجاع
                      </button>
                      <button onClick={() => { if (confirm("حذف نهائي؟")) purgeTx.mutate(t.id); }} className="text-xs flex items-center gap-1 text-expense hover:underline">
                        <Trash2 className="h-3 w-3" /> نهائي
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {assetList.length > 0 && (
        <section>
          <h2 className="text-sm font-bold mb-2 text-muted-foreground">قطع الذهب ({assetList.length})</h2>
          <ul className="space-y-2">
            {assetList.map((a: any) => {
              const left = daysLeft(a.deleted_at);
              return (
                <li key={a.id} className="bg-card border border-border rounded-2xl p-3">
                  <div className="font-medium text-sm">{a.description}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.quantity} قطعة · {formatAmount(Number(a.purchase_price_total))} {CURRENCY}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">تُحذف نهائياً خلال {left} يوم</span>
                    <div className="flex gap-2">
                      <button onClick={() => restoreAsset.mutate(a.id)} className="text-xs flex items-center gap-1 text-primary hover:underline">
                        <RotateCcw className="h-3 w-3" /> استرجاع
                      </button>
                      <button onClick={() => { if (confirm("حذف نهائي؟")) purgeAsset.mutate(a.id); }} className="text-xs flex items-center gap-1 text-expense hover:underline">
                        <Trash2 className="h-3 w-3" /> نهائي
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </AppShell>
  );
}