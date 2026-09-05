import { supabase } from "@/integrations/supabase/client";

export const CURRENCY = "دينار";

export const CATEGORIES = [
  "طعام","مواصلات","سيارة","فواتير","تسوق","ترفيه","صحة","تعليم","منزل",
  "ملابس","عناية شخصية","لياقة","هوايات","هدايا","تبرعات","زكاة","ديون",
  "خدمات","عمل","رواتب","دخل","استثمار","تحويلات","تعويضات","ضرائب",
  "برمجيات","إلكترونيات","اكسسوارات","اتصالات","استئجار","زراعة",
  "حيوانات أليفة","مستلزمات","هدية","أخرى",
];

export const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

export function formatAmount(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function formatMonthLabel(monthYear: string) {
  const [y, m] = monthYear.split("-");
  const mi = parseInt(m, 10) - 1;
  if (Number.isNaN(mi) || mi < 0 || mi > 11) return monthYear;
  return `${AR_MONTHS[mi]} ${y}`;
}

export function currentMonthYear() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type Tx = {
  id: number;
  month_year: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string | null;
  created_at?: string;
};

export type Goal = {
  id: number;
  goal_name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
};

export async function fetchAllTransactions() {
  const pageSize = 1000;
  const rows: Tx[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const page = (data ?? []) as Tx[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}