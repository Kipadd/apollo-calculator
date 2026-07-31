import assert from "node:assert/strict";
import { INCH_TO_METRE, parseDecimal, calculateItem, calculateQuote } from "./calculator.js";

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

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

console.log("10 calculation assertions passed.");
