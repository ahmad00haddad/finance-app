import { createServerFn } from "@tanstack/react-start";

type Tx = {
  month_year: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string | null;
};

export const analyzeFinance = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { scope: "month" | "year" | "all"; label: string; transactions: Tx[] }) => input,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY غير مُعدّ");

    const totalIncome = data.transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = data.transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const byCat = new Map<string, number>();
    data.transactions.filter(t => t.type === "expense").forEach(t => {
      const k = t.category ?? "أخرى";
      byCat.set(k, (byCat.get(k) ?? 0) + Number(t.amount));
    });
    const catSummary = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([c, v]) => `${c}: ${v.toFixed(2)}`).join("، ");

    const topExpenses = [...data.transactions].filter(t => t.type === "expense")
      .sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 8)
      .map(t => `${t.description} (${Number(t.amount).toFixed(2)})`).join("، ");

    const scopeLabel = data.scope === "month" ? "هذا الشهر" : data.scope === "year" ? "هذه السنة" : "كل البيانات";

    const prompt = `أنت مستشار مالي شخصي ذكي. حلّل البيانات التالية لـ${scopeLabel} (${data.label}) وقدّم رؤية واضحة باللغة العربية:

📊 الإحصائيات:
- إجمالي الإيرادات: ${totalIncome.toFixed(2)} دينار
- إجمالي المصاريف: ${totalExpense.toFixed(2)} دينار
- صافي التوفير: ${(totalIncome - totalExpense).toFixed(2)} دينار
- عدد المعاملات: ${data.transactions.length}

📂 أعلى التصنيفات إنفاقاً: ${catSummary || "لا يوجد"}

💸 أكبر المصاريف: ${topExpenses || "لا يوجد"}

قدّم التحليل بالشكل التالي (استخدم markdown مع عناوين ## وقوائم نقطية):
## 📈 الملخص العام
(2-3 أسطر عن الوضع المالي)

## ⚠️ نقاط تستحق الانتباه
(تصنيفات إنفاق مرتفعة، عادات تستهلك المال)

## 💡 اقتراحات للتوفير
(3-5 اقتراحات عملية محددة)

## 🎯 خطة للفترة القادمة
(خطوات عملية واضحة)`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "أنت مستشار مالي خبير تتحدث العربية بطلاقة وتقدم نصائح عملية مبنية على البيانات." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز الحد المسموح، حاول لاحقاً");
    if (res.status === 402) throw new Error("نفدت أرصدة الـ AI، أضف رصيداً من الإعدادات");
    if (!res.ok) throw new Error(`خطأ من الـ AI: ${res.status}`);

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "لم يتم الحصول على رد";
    return { content };
  });

const CATEGORIES = [
  "طعام","مواصلات","سيارة","فواتير","تسوق","ترفيه","صحة","تعليم","منزل",
  "ملابس","عناية شخصية","لياقة","هوايات","هدايا","تبرعات","زكاة","ديون",
  "خدمات","عمل","رواتب","دخل","استثمار","تحويلات","تعويضات","ضرائب",
  "برمجيات","إلكترونيات","اكسسوارات","اتصالات","استئجار","زراعة",
  "حيوانات أليفة","مستلزمات","هدية","أخرى",
];

export const suggestCategory = createServerFn({ method: "POST" })
  .inputValidator((input: { description: string; type: "income" | "expense" }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY غير مُعدّ");
    const desc = data.description.trim();
    if (!desc) return { category: "أخرى" };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `أنت مصنّف مالي ذكي. اختر تصنيفاً واحداً فقط من القائمة التالية بناءً على وصف المعاملة ونوعها (إيراد/مصروف). أعد الاسم بالضبط كما هو في القائمة بدون أي شرح أو علامات.\nالقائمة: ${CATEGORIES.join(" | ")}`,
          },
          { role: "user", content: `النوع: ${data.type === "income" ? "إيراد" : "مصروف"}\nالوصف: ${desc}` },
        ],
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز الحد المسموح");
    if (res.status === 402) throw new Error("نفدت أرصدة الـ AI");
    if (!res.ok) throw new Error(`خطأ من الـ AI: ${res.status}`);

    const json = await res.json();
    const raw = String(json.choices?.[0]?.message?.content ?? "").trim().replace(/[«»"'.،,`*]/g, "");
    const match = CATEGORIES.find(c => raw === c) || CATEGORIES.find(c => raw.includes(c)) || "أخرى";
    return { category: match };
  });

export const parseVoiceTransaction = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY غير مُعدّ");
    const text = data.text.trim();
    if (!text) throw new Error("النص فارغ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `أنت محلل معاملات مالية باللغة العربية. استخرج من جملة المستخدم: المبلغ (رقم)، الوصف المختصر (1-3 كلمات)، النوع (income للإيراد/الراتب/البيع، expense للدفع/الشراء/الفاتورة)، والتصنيف من القائمة. القائمة: ${CATEGORIES.join(" | ")}`,
          },
          { role: "user", content: text },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_transaction",
            description: "Extract transaction details",
            parameters: {
              type: "object",
              properties: {
                amount: { type: "number" },
                description: { type: "string" },
                type: { type: "string", enum: ["income", "expense"] },
                category: { type: "string" },
              },
              required: ["amount", "description", "type", "category"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_transaction" } },
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز الحد المسموح");
    if (res.status === 402) throw new Error("نفدت أرصدة الـ AI");
    if (!res.ok) throw new Error(`خطأ من الـ AI: ${res.status}`);

    const json = await res.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("لم يتمكن الـ AI من فهم الجملة");
    const parsed = JSON.parse(args) as { amount: number; description: string; type: "income" | "expense"; category: string };
    const category = CATEGORIES.includes(parsed.category) ? parsed.category : "أخرى";
    return { ...parsed, category };
  });

export const zakatReductionAdvice = createServerFn({ method: "POST" })
  .inputValidator((input: {
    cash: number; goldValue: number; total: number; zakat: number; nisab: number;
    avgMonthlyIncome: number; avgMonthlyExpense: number; daysToRamadan: number;
  }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY غير مُعدّ");

    const prompt = `أنا مسلم في الأردن، أزكّي كل رمضان. هذه أرقامي الحالية بالدينار الأردني:
- نقد وأرصدة: ${data.cash.toFixed(0)}
- قيمة الذهب (ليرات إنجليزية): ${data.goldValue.toFixed(0)}
- إجمالي الوعاء الزكوي: ${data.total.toFixed(0)}
- الزكاة الواجبة (2.5%): ${data.zakat.toFixed(0)}
- النصاب: ${data.nisab.toFixed(0)}
- متوسط الدخل الشهري: ${data.avgMonthlyIncome.toFixed(0)}
- متوسط المصاريف الشهرية: ${data.avgMonthlyExpense.toFixed(0)}
- الأيام المتبقية لرمضان القادم: ${data.daysToRamadan}

أنا لا أريد اكتناز المال، وأريد تحريكه في أصول ومشاريع نافعة، وليست لدي خبرة استثمارية. اشرح لي بلغة عربية بسيطة وبأرقام محسوبة من أرقامي:

قواعد فقهية مهمة يجب أن تلتزم بها:
- عروض التجارة تُزكّى على قيمتها السوقية (لا تُعفى).
- الأصول المستخدمة (بيت السكن، سيارة الاستخدام، أدوات العمل، عقار مؤجَّر) لا زكاة على أصلها، بل الزكاة على الإيجار/الدخل المتبقي عند الحول.
- الذهب والفضة والنقد تُزكّى دائماً.
- الدَّين المستحق عليك حالاً يُخصم من الوعاء عند كثير من الفقهاء.
- الزكاة ليست عقوبة؛ خفض قيمتها يكون بتحويل المال إلى أصول منتِجة أو استخدام حقيقي، لا بالتحايل أو التهرب (وهو محرَّم).

أجب بصيغة markdown بعناوين ## وقوائم نقطية وأرقام محددة:
## 🧾 وضعك الآن
## ✅ ما لا زكاة عليه (وكيف تنقل مالك إليه)
## 📊 خطة تحريك المال بأرقام (وزّع المبلغ الفائض عن مصاريف 6 أشهر بنسب مقترحة على: عقار/أرض، مشروع صغير أو شراكة، صناديق وأسهم متوافقة مع الشريعة، صكوك/مرابحة بنكية إسلامية، تطوير مهارة أو أدوات عمل، صدقة جارية)
## ⚠️ أخطاء وتحايل يجب تجنبه
## 🗓️ خطوات عملية قبل رمضان (${data.daysToRamadan} يوم)

كن واقعياً بالسوق الأردني، واذكر أن هذه ليست فتوى ويُستحسن مراجعة دار الإفتاء الأردنية للتفاصيل.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "أنت مستشار مالي إسلامي خبير بفقه الزكاة والاستثمار الحلال في الأردن، تتحدث العربية بوضوح وتعطي أرقاماً عملية." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز الحد المسموح، حاول لاحقاً");
    if (res.status === 402) throw new Error("نفدت أرصدة الـ AI");
    if (!res.ok) throw new Error(`خطأ من الـ AI: ${res.status}`);

    const json = await res.json();
    return { content: json.choices?.[0]?.message?.content ?? "لم يتم الحصول على رد" };
  });
