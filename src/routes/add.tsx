import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { CATEGORIES, currentMonthYear } from "@/lib/finance";
import { suggestCategory, parseVoiceTransaction } from "@/lib/ai.functions";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Sparkles, Mic, MicOff, Loader2, History } from "lucide-react";

export const Route = createFileRoute("/add")({ component: AddPage });

function AddPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("أخرى");
  const [monthYear, setMonthYear] = useState(currentMonthYear());
  const [autoCat, setAutoCat] = useState(false);
  const [userTouchedCat, setUserTouchedCat] = useState(false);
  const suggestFn = useServerFn(suggestCategory);
  const voiceFn = useServerFn(parseVoiceTransaction);
  const reqIdRef = useRef(0);
  const [showSuggest, setShowSuggest] = useState(false);

  const { data: history } = useQuery({
    queryKey: ["tx-history-suggest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("description, amount, category, type, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const suggestions = useMemo(() => {
    if (!history) return [] as { description: string; category: string; amount: number; count: number }[];
    const map = new Map<string, { description: string; category: string; amount: number; count: number }>();
    for (const r of history) {
      if (r.type !== type) continue;
      const key = (r.description ?? "").trim();
      if (!key) continue;
      const ex = map.get(key);
      if (ex) ex.count += 1;
      else map.set(key, { description: key, category: r.category ?? "أخرى", amount: Number(r.amount), count: 1 });
    }
    const q = description.trim();
    let arr = Array.from(map.values());
    if (q) arr = arr.filter(s => s.description.includes(q) && s.description !== q);
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, 6);
  }, [history, type, description]);

  const pickSuggestion = (s: { description: string; category: string; amount: number }) => {
    setDescription(s.description);
    setCategory(s.category);
    setUserTouchedCat(true);
    if (!amount) setAmount(String(s.amount));
    setShowSuggest(false);
  };

  const [listening, setListening] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startVoice = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("متصفحك لا يدعم التعرف على الصوت");
      return;
    }
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = async (e: any) => {
      const text = e.results[0][0].transcript;
      setListening(false);
      setVoiceProcessing(true);
      try {
        toast.info(`سمعت: "${text}"`);
        const r = await voiceFn({ data: { text } });
        setType(r.type);
        setDescription(r.description);
        setAmount(String(r.amount));
        setCategory(r.category);
        setUserTouchedCat(true);
        toast.success("تم استخراج المعاملة من الصوت");
      } catch (err: any) {
        toast.error(err?.message ?? "فشل التحليل");
      } finally {
        setVoiceProcessing(false);
      }
    };
    rec.onerror = (e: any) => {
      setListening(false);
      toast.error(`خطأ في الميكروفون: ${e.error ?? "غير معروف"}`);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const stopVoice = () => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  useEffect(() => {
    const desc = description.trim();
    if (desc.length < 2 || userTouchedCat) return;
    const myId = ++reqIdRef.current;
    const t = setTimeout(async () => {
      try {
        setAutoCat(true);
        const r = await suggestFn({ data: { description: desc, type } });
        if (myId === reqIdRef.current && !userTouchedCat) {
          setCategory(r.category);
        }
      } catch {
        /* ignore */
      } finally {
        if (myId === reqIdRef.current) setAutoCat(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [description, type, userTouchedCat, suggestFn]);

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!description.trim() || !amt || amt <= 0) throw new Error("بيانات غير صحيحة");
      const { error } = await supabase.from("transactions").insert({
        description: description.trim(),
        amount: amt,
        type,
        category,
        month_year: monthYear,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة المعاملة");
      qc.invalidateQueries();
      nav({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <Toaster position="top-center" richColors />
      <h1 className="text-xl font-bold mb-4">إضافة معاملة جديدة</h1>

      <button
        type="button"
        onClick={listening ? stopVoice : startVoice}
        disabled={voiceProcessing}
        className={`mb-4 w-full py-3 rounded-2xl border text-sm font-bold flex items-center justify-center gap-2 transition ${
          listening ? "bg-expense text-expense-foreground border-transparent animate-pulse" :
          voiceProcessing ? "bg-muted/40 border-border text-muted-foreground" :
          "bg-card border-border text-foreground"
        }`}
      >
        {voiceProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري تحليل الصوت بالـ AI…</> :
         listening ? <><MicOff className="h-4 w-4" /> أنقر لإيقاف التسجيل</> :
         <><Mic className="h-4 w-4 text-primary" /> أضف معاملة بالصوت — مثال: "دفعت 10 دنانير قهوة"</>}
      </button>

      <div className="grid grid-cols-2 gap-2 mb-4 p-1 rounded-2xl bg-card border border-border">
        <button onClick={() => setType("expense")} className={`py-3 rounded-xl text-sm font-bold transition ${type === "expense" ? "bg-expense text-expense-foreground shadow-glow" : "text-muted-foreground"}`}>مصروف</button>
        <button onClick={() => setType("income")} className={`py-3 rounded-xl text-sm font-bold transition ${type === "income" ? "bg-income text-income-foreground shadow-glow" : "text-muted-foreground"}`}>إيراد</button>
      </div>

      <Field label="الوصف">
        <div className="relative">
          <input
            value={description}
            onChange={(e) => { setDescription(e.target.value); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            placeholder="مثال: قهوة، راتب…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="tx-description-no-autofill"
            className="w-full bg-input border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {showSuggest && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
              {suggestions.map((s) => (
                <button
                  type="button"
                  key={s.description}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-right text-sm hover:bg-muted/50 border-b border-border/40 last:border-b-0"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{s.description}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{s.category}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">×{s.count}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field label="المبلغ">
        <div className="relative">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" step="0.01" placeholder="0.00" className="w-full bg-input border border-border rounded-2xl px-4 py-3 pl-16 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">دينار</span>
        </div>
      </Field>

      <Field label={
        <span className="flex items-center gap-1.5">
          التصنيف
          {autoCat && <Sparkles className="h-3 w-3 text-primary animate-pulse" />}
          {!userTouchedCat && !autoCat && description.trim().length >= 2 && (
            <span className="text-[10px] text-primary">تلقائي بالـ AI</span>
          )}
        </span>
      }>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setUserTouchedCat(true); }}
          className="w-full bg-input border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="الشهر">
        <input type="month" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} className="w-full bg-input border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </Field>

      <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="mt-2 w-full py-4 rounded-2xl bg-brand-gradient text-primary-foreground font-bold shadow-glow active:scale-[0.98] disabled:opacity-50">
        {mutation.isPending ? "جاري الحفظ…" : "حفظ المعاملة"}
      </button>
    </AppShell>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}