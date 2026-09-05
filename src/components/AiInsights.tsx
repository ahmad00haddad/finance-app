import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { analyzeFinance } from "@/lib/ai.functions";
import { toast } from "sonner";

type Tx = {
  month_year: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string | null;
};

export function AiInsights({ scope, label, transactions }: { scope: "month" | "year" | "all"; label: string; transactions: Tx[] }) {
  const fn = useServerFn(analyzeFinance);
  const [content, setContent] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => fn({ data: { scope, label, transactions } }),
    onSuccess: (r) => setContent(r.content),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="bg-card border border-border rounded-3xl p-4 mb-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-brand-gradient opacity-[0.04] pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <span className="h-7 w-7 rounded-xl bg-brand-gradient flex items-center justify-center text-primary-foreground shadow-glow">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            مستشارك المالي الذكي
          </h2>
          {content && (
            <button onClick={() => m.mutate()} disabled={m.isPending} className="text-[11px] text-muted-foreground flex items-center gap-1 hover:text-primary">
              <RefreshCw className={`h-3 w-3 ${m.isPending ? "animate-spin" : ""}`} /> إعادة
            </button>
          )}
        </div>

        {!content && !m.isPending && (
          <div>
            <p className="text-xs text-muted-foreground mb-3">احصل على تحليل ذكي ونصائح مخصصة بناءً على بياناتك لـ <b>{label}</b></p>
            <button
              onClick={() => m.mutate()}
              className="w-full py-3 rounded-2xl bg-brand-gradient text-primary-foreground text-sm font-bold shadow-glow active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" /> حلّل بياناتي بالذكاء الاصطناعي
            </button>
          </div>
        )}

        {m.isPending && (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2 text-primary" />
            <p className="text-xs">جاري تحليل بياناتك...</p>
          </div>
        )}

        {content && (
          <article className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-primary [&_ul]:my-1 [&_li]:my-0.5 [&_p]:my-1.5 [&_strong]:text-foreground">
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        )}
      </div>
    </section>
  );
}