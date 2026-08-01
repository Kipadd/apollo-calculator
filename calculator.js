import { BLIND_BANDS, BLIND_PRICE_BANDS, BLIND_WIDTHS } from "./blind-prices.js";

export const INCH_TO_METRE = 0.0254;
export const UNIT_INCHES = "inches";
export const UNIT_METRES = "metres";
export const ITEM_SHUTTER = "shutter";
export const ITEM_BLIND = "blind";

export function normalizeItemType(type) {
  return type === ITEM_BLIND ? ITEM_BLIND : ITEM_SHUTTER;
}

export function normalizeBlindBand(band) {
  return BLIND_BANDS.includes(band) ? band : "A";
}

export function normalizeStoredItem(item, storedQuoteUnit) {
  const type = normalizeItemType(item?.type);
  if (type === ITEM_BLIND) return { ...item, type, band: normalizeBlindBand(item?.band) };
  return { ...item, type, unit: normalizeUnit(item?.unit ?? storedQuoteUnit) };
}

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
    return { type: ITEM_SHUTTER, valid: false, widthInput, heightInput, widthInches, heightInches, rate, widthMetres: 0, heightMetres: 0, area: 0, basePrice: 0, surcharge: 0, total: 0 };
  }

  const widthMetres = measurementToMetres(widthInput, normalizedUnit);
  const heightMetres = measurementToMetres(heightInput, normalizedUnit);
  const area = widthMetres * heightMetres;
  const basePrice = area * rate;
  const surcharge = item.tilt === "hidden" ? basePrice * (surchargePercent / 100) : 0;

  return { type: ITEM_SHUTTER, valid: true, widthInput, heightInput, widthInches, heightInches, rate, widthMetres, heightMetres, area, basePrice, surcharge, total: basePrice + surcharge };
}

function findChargedIndex(values, input) {
  if (input > values[values.length - 1]) return -1;
  return values.findIndex((value) => value >= input);
}

export function calculateBlindItem(item) {
  const widthMm = parseDecimal(item.widthMm);
  const dropMm = parseDecimal(item.dropMm);
  const band = normalizeBlindBand(item.band);
  const baseResult = {
    type: ITEM_BLIND,
    valid: false,
    outOfRange: false,
    widthMm,
    dropMm,
    band,
    chargedWidth: 0,
    chargedDrop: 0,
    basePrice: 0,
    surcharge: 0,
    total: 0
  };

  if (!(widthMm > 0) || !(dropMm > 0)) return baseResult;

  const bandTable = BLIND_PRICE_BANDS[band];
  const widthIndex = findChargedIndex(BLIND_WIDTHS, widthMm);
  const dropIndex = findChargedIndex(bandTable.drops, dropMm);
  if (widthIndex < 0 || dropIndex < 0) return { ...baseResult, outOfRange: true };

  const basePrice = bandTable.prices[dropIndex][widthIndex];
  const surcharge = basePrice * 0.10;
  return {
    ...baseResult,
    valid: true,
    chargedWidth: BLIND_WIDTHS[widthIndex],
    chargedDrop: bandTable.drops[dropIndex],
    basePrice,
    surcharge,
    total: basePrice + surcharge
  };
}

export function calculateQuote(items, settings) {
  const results = items.map((item) => normalizeItemType(item.type) === ITEM_BLIND
    ? calculateBlindItem(item)
    : calculateItem(item, settings));
  return results.reduce((summary, result) => {
    if (result.type === ITEM_BLIND) {
      summary.blindCount += 1;
      summary.blindsSubtotal += result.total;
    } else {
      summary.shutterCount += 1;
      if (result.valid) summary.area += result.area;
      summary.subtotal += result.basePrice;
      summary.surcharge += result.surcharge;
      summary.shuttersSubtotal += result.total;
    }
    summary.total += result.total;
    return summary;
  }, {
    itemCount: items.length,
    shutterCount: 0,
    blindCount: 0,
    area: 0,
    subtotal: 0,
    surcharge: 0,
    shuttersSubtotal: 0,
    blindsSubtotal: 0,
    total: 0,
    results
  });
}
