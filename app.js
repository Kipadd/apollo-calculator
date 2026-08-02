import {
  ITEM_BLIND,
  ITEM_SHUTTER,
  ITEM_STATUS_COMPLETE,
  ITEM_STATUS_OUT_OF_RANGE,
  UNIT_INCHES,
  UNIT_METRES,
  calculateQuote,
  convertItemMeasurements,
  duplicateItem,
  formatMeasurementInput,
  normalizeBlindBand,
  normalizeItemType,
  normalizeStoredItem,
  normalizeUnit,
  parseDecimal
} from "./calculator.js";

const SETTINGS_KEY = "shutters-calculator-settings-v1";
const QUOTE_KEY = "shutters-calculator-quote-v1";
const THEME_KEY = "shutters-calculator-theme-v1";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const defaults = { woodPrice: 0, pvcPrice: 0, surcharge: 25 };
const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const createShutterItem = () => ({
  id: createId(), type: ITEM_SHUTTER, name: "", width: "", height: "",
  unit: UNIT_INCHES, material: "wood", tilt: "standard"
});

const createBlindItem = () => ({
  id: createId(), type: ITEM_BLIND, name: "", widthMm: "", dropMm: "", band: ""
});

function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

const storedSettings = readStored(SETTINGS_KEY, defaults);
let settings = {
  woodPrice: Number.isFinite(parseDecimal(storedSettings.woodPrice)) ? Math.max(0, parseDecimal(storedSettings.woodPrice)) : defaults.woodPrice,
  pvcPrice: Number.isFinite(parseDecimal(storedSettings.pvcPrice)) ? Math.max(0, parseDecimal(storedSettings.pvcPrice)) : defaults.pvcPrice,
  surcharge: Number.isFinite(parseDecimal(storedSettings.surcharge)) ? Math.max(0, parseDecimal(storedSettings.surcharge)) : defaults.surcharge
};
function restoreItem(item, storedQuoteUnit) {
  const normalized = normalizeStoredItem(item, storedQuoteUnit);
  return normalized.type === ITEM_BLIND
    ? { ...createBlindItem(), ...normalized }
    : { ...createShutterItem(), ...normalized };
}

const storedQuote = readStored(QUOTE_KEY, { customer: "", items: [createShutterItem()] });
let quote = {
  customer: typeof storedQuote.customer === "string" ? storedQuote.customer : "",
  items: Array.isArray(storedQuote.items)
    ? storedQuote.items.map((item) => restoreItem(item, storedQuote.unit))
    : [createShutterItem()]
};
const restoredSummary = calculateQuote(quote.items, settings);
let expandedItemId = quote.items.find((item, index) => restoredSummary.results[index]?.status !== ITEM_STATUS_COMPLETE)?.id
  ?? quote.items.at(-1)?.id
  ?? null;

const $ = (selector, root = document) => root.querySelector(selector);
const elements = {
  items: $("#items-list"), shutterTemplate: $("#shutter-template"), blindTemplate: $("#blind-template"),
  countBadge: $("#item-count-badge"), summaryItems: $("#summary-items"), summaryArea: $("#summary-area"),
  summaryShutters: $("#summary-shutters"), summaryBlinds: $("#summary-blinds"), summarySurcharge: $("#summary-surcharge"),
  summaryShuttersRow: $("#summary-shutters-row"), summaryBlindsRow: $("#summary-blinds-row"),
  summaryAreaRow: $("#summary-area-row"), summarySurchargeRow: $("#summary-surcharge-row"),
  summaryIncompleteRow: $("#summary-incomplete-row"), summaryIncomplete: $("#summary-incomplete"), summaryTotal: $("#summary-total"),
  stickyTotal: $("#sticky-total"), stickyValue: $("#sticky-total-value"), settingsForm: $("#settings-form"),
  woodPrice: $("#wood-price"), pvcPrice: $("#pvc-price"), tiltSurcharge: $("#tilt-surcharge"),
  settingsError: $("#settings-error"), saveFeedback: $("#save-feedback"),
  themeToggle: $("#theme-toggle"), themeLabel: $(".theme-label"), themeColor: $('meta[name="theme-color"]'),
  stickyAdd: $("#sticky-add"), quickAddMenu: $("#quick-add-menu"),
  quickAddShutter: $("#quick-add-shutter"), quickAddBlind: $("#quick-add-blind")
};

const money = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value) => money.format(Number.isFinite(value) ? value : 0).replace(/\s/g, "");
const formatMeasure = (value, unit) => Number.isFinite(value) ? `${value.toFixed(3)} ${unit}` : "—";
const persistQuote = () => localStorage.setItem(QUOTE_KEY, JSON.stringify(quote));
const persistSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

function applyTheme(theme, persist = false) {
  const nextTheme = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
  const isDark = nextTheme === THEME_DARK;
  document.documentElement.dataset.theme = nextTheme;
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  elements.themeLabel.textContent = isDark ? "Dark" : "Light";
  elements.themeColor.content = isDark ? "#0f1917" : "#153f3a";
  if (persist) localStorage.setItem(THEME_KEY, nextTheme);
}

function prepareCard(fragment, item, index, nameLabel) {
  const card = $(".item-card", fragment);
  card.dataset.id = item.id;
  card.dataset.type = item.type;
  const expanded = item.id === expandedItemId;
  card.classList.toggle("is-expanded", expanded);
  const body = $(".item-card-body", card);
  const toggle = $(".item-toggle", card);
  body.id = `item-body-${item.id}`;
  body.hidden = !expanded;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.setAttribute("aria-controls", body.id);
  const nameInput = $(".item-name", card);
  nameInput.value = item.name ?? "";
  nameInput.id = `item-name-${item.id}`;
  const label = $(".item-name-field label", card);
  label.htmlFor = nameInput.id;
  label.firstChild.textContent = `${nameLabel} `;
  return card;
}

function shutterMarkup(item, index) {
  const fragment = elements.shutterTemplate.content.cloneNode(true);
  const card = prepareCard(fragment, item, index, "Shutter name");
  const width = $(".item-width", card);
  const unitSymbol = item.unit === UNIT_METRES ? "m" : "in";
  width.value = formatMeasurementInput(item.width, item.unit);
  width.placeholder = item.unit === UNIT_METRES ? "0.000" : "0.00";
  width.id = `item-width-${item.id}`;
  $(".width-label", card).htmlFor = width.id;
  $(".width-label", card).textContent = `Width (${unitSymbol})`;
  $(".width-unit", card).textContent = unitSymbol;
  const height = $(".item-height", card);
  height.value = formatMeasurementInput(item.height, item.unit);
  height.placeholder = item.unit === UNIT_METRES ? "0.000" : "0.00";
  height.id = `item-height-${item.id}`;
  $(".height-label", card).htmlFor = height.id;
  $(".height-label", card).textContent = `Height (${unitSymbol})`;
  $(".height-unit", card).textContent = unitSymbol;
  card.querySelectorAll(".unit-control input").forEach((input) => {
    input.name = `unit-${item.id}`;
    input.checked = input.value === item.unit;
  });
  card.querySelectorAll(".material-control input").forEach((input) => {
    input.name = `material-${item.id}`;
    input.checked = input.value === item.material;
  });
  card.querySelectorAll(".tilt-control input").forEach((input) => {
    input.name = `tilt-${item.id}`;
    input.checked = input.value === item.tilt;
  });
  return fragment;
}

function blindMarkup(item, index) {
  const fragment = elements.blindTemplate.content.cloneNode(true);
  const card = prepareCard(fragment, item, index, "Blind name");
  const width = $(".blind-width", card);
  width.value = item.widthMm;
  width.id = `blind-width-${item.id}`;
  $(".blind-width-label", card).htmlFor = width.id;
  const drop = $(".blind-drop", card);
  drop.value = item.dropMm;
  drop.id = `blind-drop-${item.id}`;
  $(".blind-drop-label", card).htmlFor = drop.id;
  const band = $(".blind-band", card);
  band.value = normalizeBlindBand(item.band);
  band.id = `blind-band-${item.id}`;
  $(".blind-band-label", card).htmlFor = band.id;
  return fragment;
}

function itemMarkup(item, index) {
  return normalizeItemType(item.type) === ITEM_BLIND ? blindMarkup(item, index) : shutterMarkup(item, index);
}

function renderItems() {
  elements.items.replaceChildren(...quote.items.map(itemMarkup));
  updateCalculations();
}

function setResult(card, selector, value) {
  $(selector, card).textContent = value;
}

const formatCompactNumber = (value) => {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
};

function itemSummaryMeta(item, result) {
  if (item.type === ITEM_BLIND) {
    const parts = [];
    if (result.widthMm > 0 && result.dropMm > 0) parts.push(`${formatCompactNumber(result.widthMm)} × ${formatCompactNumber(result.dropMm)} mm`);
    if (result.band) parts.push(`Band ${result.band}`);
    return parts.join(" · ") || "Enter dimensions and price band";
  }

  const parts = [];
  if (result.widthInput > 0 && result.heightInput > 0) {
    const unit = item.unit === UNIT_METRES ? "m" : "in";
    parts.push(`${formatCompactNumber(result.widthInput)} × ${formatCompactNumber(result.heightInput)} ${unit}`);
  }
  parts.push(item.material === "pvc" ? "PVC" : "Wood");
  parts.push(item.tilt === "hidden" ? "Hidden Tilt" : "Standard Tilt");
  return parts.join(" · ");
}

function updateCardSummary(card, item, result, index) {
  const typeName = item.type === ITEM_BLIND ? "Blind" : "Shutter";
  const name = String(item.name ?? "").trim();
  setResult(card, ".item-summary-title", `${typeName} ${index + 1}${name ? ` · ${name}` : ""}`);
  setResult(card, ".item-summary-meta", itemSummaryMeta(item, result));
  setResult(card, ".item-collapsed-total", result.complete ? formatMoney(result.total) : "—");
  const badge = $(".item-status-badge", card);
  badge.hidden = result.status === ITEM_STATUS_COMPLETE;
  badge.textContent = result.status === ITEM_STATUS_OUT_OF_RANGE ? "Out of range" : "Incomplete";
  badge.classList.toggle("is-out-of-range", result.status === ITEM_STATUS_OUT_OF_RANGE);
  card.dataset.status = result.status;
}

function updateShutterResult(card, item, result) {
  const hasWidth = String(item.width).trim() !== "";
  const hasHeight = String(item.height).trim() !== "";
  const widthInvalid = hasWidth && !(parseDecimal(item.width) > 0);
  const heightInvalid = hasHeight && !(parseDecimal(item.height) > 0);
  $(".item-width", card).classList.toggle("is-invalid", widthInvalid);
  $(".item-height", card).classList.toggle("is-invalid", heightInvalid);
  $(".width-error", card).textContent = widthInvalid ? "Enter a value above 0" : "";
  $(".height-error", card).textContent = heightInvalid ? "Enter a value above 0" : "";
  $(".price-warning", card).hidden = result.rate !== 0;
  $(".surcharge-row", card).hidden = item.tilt !== "hidden";
  setResult(card, ".result-rate", formatMoney(result.rate));
  setResult(card, ".result-width", result.valid ? formatMeasure(result.widthMetres, "m") : "—");
  setResult(card, ".result-height", result.valid ? formatMeasure(result.heightMetres, "m") : "—");
  setResult(card, ".result-area", result.valid ? formatMeasure(result.area, "m²") : "—");
  setResult(card, ".result-base", result.complete ? formatMoney(result.basePrice) : "—");
  setResult(card, ".result-surcharge", result.complete ? formatMoney(result.surcharge) : "—");
  setResult(card, ".result-total", result.complete ? formatMoney(result.total) : "—");
}

function updateBlindResult(card, item, result) {
  const hasWidth = String(item.widthMm).trim() !== "";
  const hasDrop = String(item.dropMm).trim() !== "";
  const widthInvalid = hasWidth && !(parseDecimal(item.widthMm) > 0);
  const dropInvalid = hasDrop && !(parseDecimal(item.dropMm) > 0);
  $(".blind-width", card).classList.toggle("is-invalid", widthInvalid);
  $(".blind-drop", card).classList.toggle("is-invalid", dropInvalid);
  $(".blind-width-error", card).textContent = widthInvalid ? "Enter a value above 0" : "";
  $(".blind-drop-error", card).textContent = dropInvalid ? "Enter a value above 0" : "";
  $(".blind-size-warning", card).hidden = !result.outOfRange;
  const statusMessage = $(".blind-status-message", card);
  statusMessage.hidden = result.complete || result.outOfRange;
  $("span", statusMessage).textContent = result.widthMm > 0 && result.dropMm > 0 ? "Select a price band" : "Enter Width and Drop";
  $(".blind-result", card).hidden = !result.complete;
  setResult(card, ".result-blind-entered-size", result.complete ? `${formatCompactNumber(result.widthMm)} × ${formatCompactNumber(result.dropMm)} mm` : "—");
  setResult(card, ".result-blind-charged-size", result.complete ? `${result.chargedWidth} × ${result.chargedDrop} mm` : "—");
  setResult(card, ".result-blind-band", result.complete ? `Band ${result.band}` : "—");
  setResult(card, ".result-blind-base", result.complete ? formatMoney(result.basePrice) : "—");
  setResult(card, ".result-blind-surcharge", result.complete ? formatMoney(result.surcharge) : "—");
  setResult(card, ".result-blind-total", result.complete ? formatMoney(result.total) : "—");
}

function updateCalculations() {
  const summary = calculateQuote(quote.items, settings);
  const surchargeLabel = `+${settings.surcharge.toFixed(0)}%`;
  document.querySelectorAll(".surcharge-label").forEach((label) => { label.textContent = surchargeLabel; });

  summary.results.forEach((result, index) => {
    const card = elements.items.children[index];
    if (!card) return;
    const item = quote.items[index];
    if (result.type === ITEM_BLIND) updateBlindResult(card, item, result);
    else updateShutterResult(card, item, result);
    updateCardSummary(card, item, result, index);
  });

  const count = quote.items.length;
  elements.countBadge.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  elements.summaryItems.textContent = count;
  elements.summaryShuttersRow.hidden = summary.completeShutterCount === 0;
  elements.summaryBlindsRow.hidden = summary.completeBlindCount === 0;
  elements.summaryAreaRow.hidden = summary.completeShutterCount === 0 || summary.area <= 0;
  elements.summarySurchargeRow.hidden = summary.surcharge <= 0;
  elements.summaryIncompleteRow.hidden = summary.incompleteCount === 0;
  elements.summaryShutters.textContent = formatMoney(summary.shuttersSubtotal);
  elements.summaryBlinds.textContent = formatMoney(summary.blindsSubtotal);
  elements.summaryArea.textContent = formatMeasure(summary.area, "m²");
  elements.summarySurcharge.textContent = formatMoney(summary.surcharge);
  elements.summaryIncomplete.textContent = summary.incompleteCount;
  elements.summaryTotal.textContent = formatMoney(summary.total);
  elements.stickyValue.textContent = formatMoney(summary.total);
}

function addItem(createItem) {
  const item = createItem();
  quote.items.push(item);
  expandedItemId = item.id;
  persistQuote();
  renderItems();
  const card = elements.items.lastElementChild;
  card?.scrollIntoView({ behavior: "smooth", block: "center" });
  $(".item-name", card)?.focus({ preventScroll: true });
}

elements.items.addEventListener("input", (event) => {
  const card = event.target.closest(".item-card");
  const item = quote.items.find((entry) => entry.id === card?.dataset.id);
  if (!item) return;
  if (event.target.matches(".item-name")) item.name = event.target.value;
  if (item.type === ITEM_BLIND) {
    if (event.target.matches(".blind-width")) item.widthMm = event.target.value;
    if (event.target.matches(".blind-drop")) item.dropMm = event.target.value;
    if (event.target.matches(".blind-band")) item.band = normalizeBlindBand(event.target.value);
  } else {
    if (event.target.matches(".item-width")) item.width = event.target.value;
    if (event.target.matches(".item-height")) item.height = event.target.value;
    if (event.target.matches(".unit-control input")) {
      const nextUnit = normalizeUnit(event.target.value);
      Object.assign(item, convertItemMeasurements(item, item.unit, nextUnit));
      persistQuote();
      renderItems();
      return;
    }
    if (event.target.matches(".material-control input")) item.material = event.target.value;
    if (event.target.matches(".tilt-control input")) item.tilt = event.target.value;
  }
  persistQuote();
  updateCalculations();
});

elements.items.addEventListener("click", (event) => {
  const card = event.target.closest(".item-card");
  if (!card) return;
  const index = quote.items.findIndex((entry) => entry.id === card.dataset.id);
  if (index < 0) return;

  if (event.target.closest(".item-toggle")) {
    expandedItemId = expandedItemId === card.dataset.id ? null : card.dataset.id;
    renderItems();
    return;
  }

  if (event.target.closest(".duplicate-item")) {
    const copy = duplicateItem(quote.items[index], createId());
    quote.items.splice(index + 1, 0, copy);
    expandedItemId = copy.id;
    persistQuote();
    renderItems();
    elements.items.children[index + 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (event.target.closest(".delete-item")) {
    quote.items.splice(index, 1);
    if (expandedItemId === card.dataset.id) expandedItemId = quote.items[Math.min(index, quote.items.length - 1)]?.id ?? null;
    persistQuote();
    renderItems();
  }
});

$("#add-shutter").addEventListener("click", () => addItem(createShutterItem));
$("#add-blind").addEventListener("click", () => addItem(createBlindItem));
function setQuickAddOpen(open) {
  elements.quickAddMenu.hidden = !open;
  elements.stickyAdd.setAttribute("aria-expanded", String(open));
  elements.stickyAdd.setAttribute("aria-label", open ? "Close quick add menu" : "Open quick add menu");
  elements.stickyAdd.classList.toggle("is-open", open);
}

elements.stickyAdd.addEventListener("click", () => setQuickAddOpen(elements.quickAddMenu.hidden));
elements.quickAddShutter.addEventListener("click", () => { setQuickAddOpen(false); addItem(createShutterItem); });
elements.quickAddBlind.addEventListener("click", () => { setQuickAddOpen(false); addItem(createBlindItem); });
document.addEventListener("click", (event) => {
  if (!elements.quickAddMenu.hidden && !event.target.closest(".quick-add")) setQuickAddOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.quickAddMenu.hidden) {
    setQuickAddOpen(false);
    elements.stickyAdd.focus();
  }
});
$("#reset-quote").addEventListener("click", () => {
  if (!confirm("Reset this quote? Your saved pricing will not be changed.")) return;
  quote = { customer: "", items: [createShutterItem()] };
  expandedItemId = quote.items[0].id;
  persistQuote();
  renderItems();
  scrollTo({ top: 0, behavior: "smooth" });
});

function showView(viewName) {
  setQuickAddOpen(false);
  document.querySelectorAll(".view").forEach((view) => {
    const active = view.id === `${viewName}-view`;
    view.hidden = !active;
    view.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("is-active", active);
    active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
  });
  elements.stickyTotal.hidden = viewName !== "calculator";
  history.replaceState(null, "", `#${viewName}`);
  scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-button[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
elements.themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  applyTheme(nextTheme, true);
});

elements.woodPrice.value = String(settings.woodPrice);
elements.pvcPrice.value = String(settings.pvcPrice);
elements.tiltSurcharge.value = String(settings.surcharge);
elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = [parseDecimal(elements.woodPrice.value), parseDecimal(elements.pvcPrice.value), parseDecimal(elements.tiltSurcharge.value)];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    elements.settingsError.textContent = "Enter zero or a positive number in every field.";
    elements.saveFeedback.textContent = "";
    return;
  }
  [settings.woodPrice, settings.pvcPrice, settings.surcharge] = values;
  persistSettings();
  updateCalculations();
  elements.settingsError.textContent = "";
  elements.saveFeedback.textContent = "Settings saved";
  setTimeout(() => { elements.saveFeedback.textContent = ""; }, 2400);
});

applyTheme(document.documentElement.dataset.theme);
renderItems();
if (location.hash === "#settings") showView("settings");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
