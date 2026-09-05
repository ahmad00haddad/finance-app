import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function BackupButton() {
  const handleExport = async () => {
    try {
      const [tx, assets, goldPrices, goals] = await Promise.all([
        supabase.from("transactions").select("*").order("id"),
        supabase.from("assets").select("*").order("id"),
        supabase.from("gold_prices").select("*").order("id"),
        supabase.from("financial_goals").select("*").order("id"),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        version: 1,
        transactions: tx.data ?? [],
        assets: assets.data ?? [],
        gold_prices: goldPrices.data ?? [],
        financial_goals: goals.data ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      a.href = url;
      a.download = `backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`تم تصدير ${payload.transactions.length} معاملة و ${payload.assets.length} أصل`);
    } catch (e: any) {
      toast.error("فشل التصدير: " + (e?.message ?? "خطأ غير معروف"));
    }
  };

  return (
    <Button onClick={handleExport} variant="outline" className="w-full gap-2">
      <Download className="h-4 w-4" />
      تصدير نسخة احتياطية (JSON)
    </Button>
  );
}