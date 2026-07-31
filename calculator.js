export const INCH_TO_METRE = 0.0254;

export function parseDecimal(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return NaN;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

export function calculateItem(item, settings) {
  const widthInches = parseDecimal(item.width);
  const heightInches = parseDecimal(item.height);
  const material = item.material === "pvc" ? "pvc" : "wood";
  const rate = Math.max(0, parseDecimal(settings[`${material}Price`]) || 0);
  const surchargePercent = Math.max(0, parseDecimal(settings.surcharge) || 0);
  const valid = widthInches > 0 && heightInches > 0;

  if (!valid) {
    return { valid: false, widthInches, heightInches, rate, widthMetres: 0, heightMetres: 0, area: 0, basePrice: 0, surcharge: 0, total: 0 };
  }

  const widthMetres = widthInches * INCH_TO_METRE;
  const heightMetres = heightInches * INCH_TO_METRE;
  const area = widthMetres * heightMetres;
  const basePrice = area * rate;
  const surcharge = item.tilt === "hidden" ? basePrice * (surchargePercent / 100) : 0;

  return { valid: true, widthInches, heightInches, rate, widthMetres, heightMetres, area, basePrice, surcharge, total: basePrice + surcharge };
}

export function calculateQuote(items, settings) {
  const results = items.map((item) => calculateItem(item, settings));
  return results.reduce((summary, result) => {
    if (result.valid) summary.area += result.area;
    summary.subtotal += result.basePrice;
    summary.surcharge += result.surcharge;
    summary.total += result.total;
    return summary;
  }, { itemCount: items.length, area: 0, subtotal: 0, surcharge: 0, total: 0, results });
}
