export const INCH_TO_METRE = 0.0254;
export const UNIT_INCHES = "inches";
export const UNIT_METRES = "metres";

export function normalizeUnit(unit) {
  return unit === UNIT_METRES ? UNIT_METRES : UNIT_INCHES;
}

export function parseDecimal(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return NaN;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

export function measurementToMetres(value, unit = UNIT_INCHES) {
  const parsed = parseDecimal(value);
  return normalizeUnit(unit) === UNIT_METRES ? parsed : parsed * INCH_TO_METRE;
}

export function convertMeasurement(value, fromUnit, toUnit) {
  const parsed = parseDecimal(value);
  const sourceUnit = normalizeUnit(fromUnit);
  const targetUnit = normalizeUnit(toUnit);
  if (!(parsed > 0) || sourceUnit === targetUnit) return value;
  return targetUnit === UNIT_METRES ? parsed * INCH_TO_METRE : parsed / INCH_TO_METRE;
}

export function convertItemMeasurements(item, fromUnit, toUnit) {
  const targetUnit = normalizeUnit(toUnit);
  return {
    ...item,
    unit: targetUnit,
    width: convertMeasurement(item.width, fromUnit, toUnit),
    height: convertMeasurement(item.height, fromUnit, toUnit)
  };
}

export function formatMeasurementInput(value, unit = UNIT_INCHES) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "");
  const decimalPlaces = normalizeUnit(unit) === UNIT_METRES ? 6 : 8;
  return value.toFixed(decimalPlaces).replace(/\.?0+$/u, "");
}

export function calculateItem(item, settings, unit = item.unit) {
  const normalizedUnit = normalizeUnit(unit);
  const widthInput = parseDecimal(item.width);
  const heightInput = parseDecimal(item.height);
  const widthInches = normalizedUnit === UNIT_METRES ? widthInput / INCH_TO_METRE : widthInput;
  const heightInches = normalizedUnit === UNIT_METRES ? heightInput / INCH_TO_METRE : heightInput;
  const material = item.material === "pvc" ? "pvc" : "wood";
  const rate = Math.max(0, parseDecimal(settings[`${material}Price`]) || 0);
  const surchargePercent = Math.max(0, parseDecimal(settings.surcharge) || 0);
  const valid = widthInput > 0 && heightInput > 0;

  if (!valid) {
    return { valid: false, widthInput, heightInput, widthInches, heightInches, rate, widthMetres: 0, heightMetres: 0, area: 0, basePrice: 0, surcharge: 0, total: 0 };
  }

  const widthMetres = measurementToMetres(widthInput, normalizedUnit);
  const heightMetres = measurementToMetres(heightInput, normalizedUnit);
  const area = widthMetres * heightMetres;
  const basePrice = area * rate;
  const surcharge = item.tilt === "hidden" ? basePrice * (surchargePercent / 100) : 0;

  return { valid: true, widthInput, heightInput, widthInches, heightInches, rate, widthMetres, heightMetres, area, basePrice, surcharge, total: basePrice + surcharge };
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
