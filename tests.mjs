import assert from "node:assert/strict";
import {
  INCH_TO_METRE,
  ITEM_BLIND,
  ITEM_SHUTTER,
  ITEM_STATUS_COMPLETE,
  ITEM_STATUS_INCOMPLETE,
  ITEM_STATUS_OUT_OF_RANGE,
  UNIT_INCHES,
  UNIT_METRES,
  calculateBlindItem,
  calculateItem,
  calculateQuote,
  convertItemMeasurements,
  duplicateItem,
  formatMeasurementInput,
  normalizeItemType,
  normalizeStoredItem,
  normalizeUnit,
  parseDecimal
} from "./calculator.js";
import { BLIND_BANDS, BLIND_PRICE_BANDS, BLIND_WIDTHS, validateBlindPriceTable } from "./blind-prices.js";

const near = (actual, expected, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

near(40 * INCH_TO_METRE, 1.016);
assert.equal(parseDecimal("40,5"), 40.5);
assert.equal(parseDecimal("40.5"), 40.5);
assert.equal(calculateItem({ width: "0", height: "20", material: "wood", tilt: "standard" }, { woodPrice: 100, surcharge: 25 }).valid, false);

const wood = calculateItem({ width: 40.5, height: 50.25, material: "wood", tilt: "hidden" }, { woodPrice: 120, pvcPrice: 80, surcharge: 25 });
near(wood.area, (40.5 * 0.0254) * (50.25 * 0.0254));
near(wood.surcharge, wood.basePrice * 0.25);

const pvc = calculateItem({ width: 40.5, height: 50.25, material: "pvc", tilt: "standard" }, { woodPrice: 120, pvcPrice: 80, surcharge: 25 });
assert.equal(wood.rate, 120);
assert.equal(pvc.rate, 80);

const quote = calculateQuote([
  { width: 40, height: 50, material: "wood", tilt: "hidden" },
  { width: 30, height: 60, material: "pvc", tilt: "standard" }
], { woodPrice: 100, pvcPrice: 80, surcharge: 25 });
assert.equal(quote.itemCount, 2);
near(quote.total, quote.subtotal + quote.surcharge);
assert.equal(calculateItem({ width: 40, height: 50, material: "wood", tilt: "hidden" }, { woodPrice: 0, surcharge: 25 }).total, 0);

const oneMetreInInches = calculateItem(
  { width: 39.3700787, height: 39.3700787, unit: UNIT_INCHES, material: "wood", tilt: "standard" },
  { woodPrice: 100, surcharge: 25 }
);
const oneMetre = calculateItem(
  { width: 1, height: 1, unit: UNIT_METRES, material: "wood", tilt: "standard" },
  { woodPrice: 100, surcharge: 25 }
);
near(oneMetreInInches.area, oneMetre.area, 1e-6);
near(oneMetreInInches.total, oneMetre.total, 1e-6);

const originalItem = { width: "48,25", height: "36.5", unit: UNIT_INCHES, material: "wood", tilt: "hidden" };
const originalResult = calculateItem(originalItem, { woodPrice: 120, surcharge: 25 });
const metricItem = convertItemMeasurements(originalItem, UNIT_INCHES, UNIT_METRES);
const metricResult = calculateItem(metricItem, { woodPrice: 120, surcharge: 25 });
near(metricResult.area, originalResult.area);
near(metricResult.total, originalResult.total);

const roundTripItem = convertItemMeasurements(metricItem, UNIT_METRES, UNIT_INCHES);
const roundTripResult = calculateItem(roundTripItem, { woodPrice: 120, surcharge: 25 });
near(roundTripResult.area, originalResult.area);
near(roundTripResult.total, originalResult.total);

const legacyReload = JSON.parse(JSON.stringify({ customer: "Legacy", items: [{ width: 40, height: 50 }] }));
assert.equal(normalizeUnit(legacyReload.items[0].unit), UNIT_INCHES);

const metricReload = JSON.parse(JSON.stringify({ customer: "Metric", items: [metricItem] }));
assert.equal(normalizeUnit(metricReload.items[0].unit), UNIT_METRES);
const globalMetricReload = JSON.parse(JSON.stringify({ unit: UNIT_METRES, items: [{ width: 1, height: 1 }] }));
assert.equal(normalizeUnit(globalMetricReload.items[0].unit ?? globalMetricReload.unit), UNIT_METRES);
assert.equal(formatMeasurementInput(1.23456789, UNIT_METRES), "1.234568");
assert.equal(formatMeasurementInput(40, UNIT_INCHES), "40");

const mixedUnitQuote = calculateQuote([
  { width: 39.3700787, height: 39.3700787, unit: UNIT_INCHES, material: "wood", tilt: "standard" },
  { width: 1, height: 1, unit: UNIT_METRES, material: "wood", tilt: "standard" }
], { woodPrice: 100, surcharge: 25 });
assert.equal(mixedUnitQuote.itemCount, 2);
near(mixedUnitQuote.results[0].area, 1, 1e-6);
near(mixedUnitQuote.results[1].area, 1);
near(mixedUnitQuote.total, 200, 1e-6);

assert.equal(validateBlindPriceTable(), true);
assert.equal(BLIND_WIDTHS.length, 16);
for (const band of BLIND_BANDS) {
  assert.equal(BLIND_PRICE_BANDS[band].prices.length, BLIND_PRICE_BANDS[band].drops.length);
  for (const row of BLIND_PRICE_BANDS[band].prices) assert.equal(row.length, 16);
}

const exactBlind = calculateBlindItem({ type: ITEM_BLIND, widthMm: 1670, dropMm: 2438, band: "C" });
assert.equal(exactBlind.chargedWidth, 1670);
assert.equal(exactBlind.chargedDrop, 2438);
assert.equal(exactBlind.basePrice, 231);

const requiredBlind = calculateBlindItem({ type: ITEM_BLIND, widthMm: 1600, dropMm: 2000, band: "C" });
assert.equal(requiredBlind.chargedWidth, 1670);
assert.equal(requiredBlind.chargedDrop, 2438);
assert.equal(requiredBlind.basePrice, 231);
near(requiredBlind.surcharge, 23.10);
near(requiredBlind.total, 254.10);

const minimumBlind = calculateBlindItem({ type: ITEM_BLIND, widthMm: 100, dropMm: 100, band: "A" });
assert.equal(minimumBlind.chargedWidth, 508);
assert.equal(minimumBlind.chargedDrop, 1219);

const bandPrices = BLIND_BANDS.map((band) => calculateBlindItem({ type: ITEM_BLIND, widthMm: 1600, dropMm: 2000, band }).basePrice);
assert.equal(new Set(bandPrices).size, 7);
for (const band of ["A", "B"]) {
  assert.equal(calculateBlindItem({ type: ITEM_BLIND, widthMm: 508, dropMm: 1219, band }).chargedDrop, 1219);
}
for (const band of ["C", "D", "E", "F", "G"]) {
  assert.equal(calculateBlindItem({ type: ITEM_BLIND, widthMm: 508, dropMm: 1219, band }).chargedDrop, 1727);
}

const overWidthBlind = calculateBlindItem({ type: ITEM_BLIND, widthMm: 3455.01, dropMm: 2000, band: "A" });
assert.equal(overWidthBlind.outOfRange, true);
assert.equal(overWidthBlind.total, 0);
const overDropBlind = calculateBlindItem({ type: ITEM_BLIND, widthMm: 1600, dropMm: 3302.01, band: "A" });
assert.equal(overDropBlind.outOfRange, true);
assert.equal(overDropBlind.total, 0);
assert.equal(calculateBlindItem({ type: ITEM_BLIND, widthMm: "1600,5", dropMm: "2000,5", band: "C" }).valid, true);
assert.equal(calculateBlindItem({ type: ITEM_BLIND, widthMm: Infinity, dropMm: 2000, band: "A" }).valid, false);

const shutterForMixedQuote = { id: "s", type: ITEM_SHUTTER, width: 1, height: 1, unit: UNIT_METRES, material: "wood", tilt: "standard" };
const blindForMixedQuote = { id: "b", type: ITEM_BLIND, widthMm: 1600, dropMm: 2000, band: "C" };
const mixedProductQuote = calculateQuote([shutterForMixedQuote, blindForMixedQuote], { woodPrice: 100, pvcPrice: 80, surcharge: 25 });
near(mixedProductQuote.shuttersSubtotal, 100);
near(mixedProductQuote.blindsSubtotal, 254.10);
near(mixedProductQuote.total, 354.10);
assert.equal(mixedProductQuote.shutterCount, 1);
assert.equal(mixedProductQuote.blindCount, 1);
const outOfRangeQuote = calculateQuote([
  shutterForMixedQuote,
  { id: "over", type: ITEM_BLIND, widthMm: 4000, dropMm: 2000, band: "A" }
], { woodPrice: 100, pvcPrice: 80, surcharge: 25 });
near(outOfRangeQuote.total, 100);

assert.equal(normalizeItemType(undefined), ITEM_SHUTTER);
assert.equal(normalizeStoredItem({ id: "legacy", width: 40, height: 50 }).type, ITEM_SHUTTER);
const savedBlind = JSON.parse(JSON.stringify({ id: "b", type: ITEM_BLIND, name: "Office", widthMm: "1600", dropMm: "2000", band: "C" }));
assert.deepEqual(normalizeStoredItem(savedBlind), { id: "b", type: ITEM_BLIND, name: "Office", widthMm: "1600", dropMm: "2000", band: "C" });

const afterBlindDeletion = calculateQuote([shutterForMixedQuote], { woodPrice: 100, pvcPrice: 80, surcharge: 25 });
near(afterBlindDeletion.total, 100);
assert.equal(afterBlindDeletion.blindCount, 0);
const resetQuote = calculateQuote([{ type: ITEM_SHUTTER, width: "", height: "", unit: UNIT_INCHES, material: "wood", tilt: "standard" }], { woodPrice: 100, pvcPrice: 80, surcharge: 25 });
assert.equal(resetQuote.blindCount, 0);
assert.equal(resetQuote.total, 0);

const newBlindWithoutBand = normalizeStoredItem({ id: "new", type: ITEM_BLIND, widthMm: "", dropMm: "" });
assert.equal(newBlindWithoutBand.band, "");
const incompleteBlind = calculateBlindItem({ type: ITEM_BLIND, widthMm: 1600, dropMm: 2000, band: "" });
assert.equal(incompleteBlind.status, ITEM_STATUS_INCOMPLETE);
assert.equal(incompleteBlind.complete, false);
assert.equal(incompleteBlind.total, 0);
const incompleteBlindQuote = calculateQuote([{ type: ITEM_BLIND, widthMm: 1600, dropMm: 2000, band: "" }], { woodPrice: 100, surcharge: 25 });
assert.equal(incompleteBlindQuote.itemCount, 1);
assert.equal(incompleteBlindQuote.completeBlindCount, 0);
assert.equal(incompleteBlindQuote.incompleteCount, 1);
assert.equal(incompleteBlindQuote.blindsSubtotal, 0);
assert.equal(incompleteBlindQuote.total, 0);
assert.equal(calculateBlindItem({ type: ITEM_BLIND, widthMm: 1600, dropMm: 2000, band: "C" }).status, ITEM_STATUS_COMPLETE);
assert.equal(normalizeStoredItem({ type: ITEM_BLIND, band: "A" }).band, "A");

const duplicatedBlind = duplicateItem({ id: "blind-original", type: ITEM_BLIND, name: "Office", widthMm: "1600", dropMm: "2000", band: "C" }, "blind-copy");
assert.equal(duplicatedBlind.id, "blind-copy");
assert.equal(duplicatedBlind.name, "Office Copy");
assert.deepEqual({ ...duplicatedBlind, id: undefined, name: undefined }, {
  id: undefined, type: ITEM_BLIND, name: undefined, widthMm: "1600", dropMm: "2000", band: "C"
});
const duplicatedShutter = duplicateItem({ id: "shutter-original", type: ITEM_SHUTTER, name: "", width: 1, height: 1, unit: UNIT_METRES, material: "wood", tilt: "hidden" }, "shutter-copy");
assert.equal(duplicatedShutter.id, "shutter-copy");
assert.equal(duplicatedShutter.name, "");
assert.equal(duplicatedShutter.unit, UNIT_METRES);
assert.equal(duplicatedShutter.material, "wood");
assert.equal(duplicatedShutter.tilt, "hidden");
const duplicateTotals = calculateQuote([shutterForMixedQuote, { ...shutterForMixedQuote, id: "s-copy" }], { woodPrice: 100, surcharge: 25 });
near(duplicateTotals.total, 200);
assert.equal(duplicateTotals.itemCount, 2);

const incompleteShutter = calculateItem({ type: ITEM_SHUTTER, width: 1, height: 1, unit: UNIT_METRES, material: "wood", tilt: "standard" }, { woodPrice: 0, surcharge: 25 });
assert.equal(incompleteShutter.valid, true);
assert.equal(incompleteShutter.status, ITEM_STATUS_INCOMPLETE);
const mixedCompletionQuote = calculateQuote([
  { type: ITEM_BLIND, widthMm: 1600, dropMm: 2000, band: "C" },
  { type: ITEM_SHUTTER, width: 1, height: 1, unit: UNIT_METRES, material: "wood", tilt: "standard" }
], { woodPrice: 0, surcharge: 25 });
assert.equal(mixedCompletionQuote.itemCount, 2);
assert.equal(mixedCompletionQuote.completeBlindCount, 1);
assert.equal(mixedCompletionQuote.completeShutterCount, 0);
assert.equal(mixedCompletionQuote.incompleteCount, 1);
near(mixedCompletionQuote.total, 254.10);
near(mixedCompletionQuote.blindsSubtotal, 254.10);
assert.equal(mixedCompletionQuote.shuttersSubtotal, 0);
assert.equal(mixedCompletionQuote.surcharge, 0);
assert.equal(calculateBlindItem({ type: ITEM_BLIND, widthMm: 4000, dropMm: 2000, band: "" }).status, ITEM_STATUS_OUT_OF_RANGE);

console.log("All shutter and blind calculation, lookup, migration, persistence, and summary assertions passed.");
