import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// English Sovereign (ليرة انجليزي): total 7.98805g, 22K → 7.32238g pure gold = 0.2354 troy oz
const SOVEREIGN_PURE_OZ = 0.2354;
// JOD is pegged to USD: 1 USD ≈ 0.709 JOD
const USD_TO_JOD = 0.709;
// Local Jordan dealer markups (typical for gold coins)
const BUY_MARKUP = 1.04;   // what you'd pay to buy today (4% above melt)
const SELL_MARKUP = 0.99;  // what dealer pays you to sell (1% below melt)

// Refresh prices at most every 6 hours
const REFRESH_MS = 6 * 60 * 60 * 1000;

async function fetchSpotUsdPerOz(): Promise<number> {
  const res = await fetch("https://api.gold-api.com/price/XAU", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`gold-api failed: ${res.status}`);
  const j = (await res.json()) as { price?: number };
  if (!j.price || typeof j.price !== "number") throw new Error("invalid response");
  return j.price;
}

export const refreshGoldPrices = createServerFn({ method: "POST" })
  .inputValidator((input: { force?: boolean }) => input ?? {})
  .handler(async ({ data }) => {
    const { data: existing } = await supabaseAdmin
      .from("gold_prices")
      .select("*")
      .eq("asset_type", "gold_english_pound")
      .maybeSingle();

    const stale = !existing ||
      Date.now() - new Date(existing.updated_at as string).getTime() > REFRESH_MS;
    const isManual = existing?.source === "manual";

    // لا نستبدل القيم اليدوية تلقائيًا — فقط عند force=true
    if (!data?.force && existing && (!stale || isManual)) {
      return {
        buy: Number(existing.buy_price),
        sell: Number(existing.sell_price),
        updated_at: existing.updated_at,
        cached: true,
      };
    }

    const spotUsd = await fetchSpotUsdPerOz();
    const meltJod = spotUsd * USD_TO_JOD * SOVEREIGN_PURE_OZ;
    const buy = Math.round(meltJod * BUY_MARKUP * 100) / 100;
    const sell = Math.round(meltJod * SELL_MARKUP * 100) / 100;

    const { error } = await supabaseAdmin
      .from("gold_prices")
      .upsert(
        {
          asset_type: "gold_english_pound",
          buy_price: buy,
          sell_price: sell,
          source: "gold-api.com",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "asset_type" },
      );
    if (error) throw new Error(error.message);

    return { buy, sell, updated_at: new Date().toISOString(), cached: false };
  });