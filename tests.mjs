import assert from "node:assert/strict";
import {
  INCH_TO_METRE,
  UNIT_INCHES,
  UNIT_METRES,
  calculateItem,
  calculateQuote,
  convertItemMeasurements,
  formatMeasurementInput,
  normalizeUnit,
  parseDecimal
} from "./calculator.js";

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

console.log("26 calculation, conversion, migration, persistence, and formatting assertions passed.");
