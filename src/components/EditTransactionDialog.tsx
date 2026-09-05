import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Tx } from "@/lib/finance";
import { toast } from "sonner";
import { X } from "lucide-react";

export function EditTransactionDialog({ tx, onClose }: { tx: Tx | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("أخرى");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [monthYear, setMonthYear] = useState("");

  useEffect(() => {
    if (tx) {
      setDescription(tx.description);
      setAmount(String(tx.amount));
      setCategory(tx.category ?? "أخرى");
      setType(tx.type);
      setMonthYear(tx.month_year);
    }
  }, [tx]);

  const m = useMutation({
    mutationFn: async () => {
      if (!tx) return;
      const amt = parseFloat(amount);
      if (!description.trim() || !amt || amt <= 0) throw new Error("بيانات غير صحيحة");
      const { error } = await supabase.from("transactions").update({
        description: description.trim(), amount: amt, category, type, month_year: monthYear,
      }).eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم التحديث"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tx) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">تعديل المعاملة</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 p-1 rounded-2xl bg-muted/40">
          <button onClick={() => setType("expense")} className={`py-2.5 rounded-xl text-xs font-bold ${type === "expense" ? "bg-expense text-expense-foreground" : "text-muted-foreground"}`}>مصروف</button>
          <button onClick={() => setType("income")} className={`py-2.5 rounded-xl text-xs font-bold ${type === "income" ? "bg-income text-income-foreground" : "text-muted-foreground"}`}>إيراد</button>
        </div>

        <label className="block mb-2.5">
          <span className="block text-[11px] text-muted-foreground mb-1">الوصف</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-input border border-border rounded-2xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="block mb-2.5">
          <span className="block text-[11px] text-muted-foreground mb-1">المبلغ</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" className="w-full bg-input border border-border rounded-2xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="block mb-2.5">
          <span className="block text-[11px] text-muted-foreground mb-1">التصنيف</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-input border border-border rounded-2xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block mb-4">
          <span className="block text-[11px] text-muted-foreground mb-1">الشهر</span>
          <input type="month" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} className="w-full bg-input border border-border rounded-2xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </label>

        <button onClick={() => m.mutate()} disabled={m.isPending} className="w-full py-3 rounded-2xl bg-brand-gradient text-primary-foreground font-bold shadow-glow disabled:opacity-50">
          {m.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
        </button>
      </div>
    </div>
  );
}