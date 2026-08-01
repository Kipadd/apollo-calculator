import {
  ITEM_BLIND,
  ITEM_SHUTTER,
  UNIT_INCHES,
  UNIT_METRES,
  calculateQuote,
  convertItemMeasurements,
  formatMeasurementInput,
  normalizeBlindBand,
  normalizeItemType,
  normalizeStoredItem,
  normalizeUnit,
  parseDecimal
} from "./calculator.js";

const SETTINGS_KEY = "shutters-calculator-settings-v1";
const QUOTE_KEY = "shutters-calculator-quote-v1";
const defaults = { woodPrice: 0, pvcPrice: 0, surcharge: 25 };
const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const createShutterItem = () => ({
  id: createId(), type: ITEM_SHUTTER, name: "", width: "", height: "",
  unit: UNIT_INCHES, material: "wood", tilt: "standard"
});

const createBlindItem = () => ({
  id: createId(), type: ITEM_BLIND, name: "", widthMm: "", dropMm: "", band: "A"
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

const $ = (selector, root = document) => root.querySelector(selector);
const elements = {
  customer: $("#customer"), items: $("#items-list"), shutterTemplate: $("#shutter-template"), blindTemplate: $("#blind-template"),
  countBadge: $("#item-count-badge"), summaryItems: $("#summary-items"), summaryArea: $("#summary-area"),
  summaryShutters: $("#summary-shutters"), summaryBlinds: $("#summary-blinds"), summarySurcharge: $("#summary-surcharge"),
  summaryShuttersRow: $("#summary-shutters-row"), summaryBlindsRow: $("#summary-blinds-row"),
  summaryAreaRow: $("#summary-area-row"), summarySurchargeRow: $("#summary-surcharge-row"), summaryTotal: $("#summary-total"),
  stickyTotal: $("#sticky-total"), stickyValue: $("#sticky-total-value"), settingsForm: $("#settings-form"),
  woodPrice: $("#wood-price"), pvcPrice: $("#pvc-price"), tiltSurcharge: $("#tilt-surcharge"),
  settingsError: $("#settings-error"), saveFeedback: $("#save-feedback")
};

const money = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value) => money.format(Number.isFinite(value) ? value : 0).replace(/\s/g, "");
const formatMeasure = (value, unit) => Number.isFinite(value) ? `${value.toFixed(3)} ${unit}` : "—";
const formatMillimetres = (value) => Number.isFinite(value) ? `${value} mm` : "—";
const persistQuote = () => localStorage.setItem(QUOTE_KEY, JSON.stringify(quote));
const persistSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

function prepareCard(fragment, item, index, nameLabel) {
  const card = $(".item-card", fragment);
  card.dataset.id = item.id;
  card.dataset.type = item.type;
  $(".item-number", card).textContent = index + 1;
  const nameInput = $(".item-name", card);
  nameInput.value = item.name;
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
  setResult(card, ".result-base", result.valid ? formatMoney(result.basePrice) : "—");
  setResult(card, ".result-surcharge", result.valid ? formatMoney(result.surcharge) : "—");
  setResult(card, ".result-total", result.valid ? formatMoney(result.total) : "—");
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
  setResult(card, ".result-blind-entered-width", result.widthMm > 0 ? formatMillimetres(result.widthMm) : "—");
  setResult(card, ".result-blind-entered-drop", result.dropMm > 0 ? formatMillimetres(result.dropMm) : "—");
  setResult(card, ".result-blind-band", `Band ${result.band}`);
  setResult(card, ".result-blind-charged-width", result.valid ? formatMillimetres(result.chargedWidth) : "—");
  setResult(card, ".result-blind-charged-drop", result.valid ? formatMillimetres(result.chargedDrop) : "—");
  setResult(card, ".result-blind-base", result.valid ? formatMoney(result.basePrice) : "—");
  setResult(card, ".result-blind-surcharge", result.valid ? formatMoney(result.surcharge) : "—");
  setResult(card, ".result-blind-total", result.valid ? formatMoney(result.total) : "—");
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
  });

  const count = quote.items.length;
  elements.countBadge.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  elements.summaryItems.textContent = count;
  elements.summaryShuttersRow.hidden = summary.shutterCount === 0;
  elements.summaryBlindsRow.hidden = summary.blindCount === 0;
  elements.summaryAreaRow.hidden = summary.shutterCount === 0;
  elements.summarySurchargeRow.hidden = summary.shutterCount === 0;
  elements.summaryShutters.textContent = formatMoney(summary.shuttersSubtotal);
  elements.summaryBlinds.textContent = formatMoney(summary.blindsSubtotal);
  elements.summaryArea.textContent = summary.area > 0 ? formatMeasure(summary.area, "m²") : "—";
  elements.summarySurcharge.textContent = formatMoney(summary.surcharge);
  elements.summaryTotal.textContent = formatMoney(summary.total);
  elements.stickyValue.textContent = formatMoney(summary.total);
}

function addItem(createItem) {
  quote.items.push(createItem());
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
  const button = event.target.closest(".delete-item");
  if (!button) return;
  const card = button.closest(".item-card");
  quote.items = quote.items.filter((entry) => entry.id !== card.dataset.id);
  persistQuote();
  renderItems();
});

elements.customer.value = quote.customer;
elements.customer.addEventListener("input", () => { quote.customer = elements.customer.value; persistQuote(); });
$("#add-shutter").addEventListener("click", () => addItem(createShutterItem));
$("#add-blind").addEventListener("click", () => addItem(createBlindItem));
$("#sticky-add").addEventListener("click", () => addItem(createShutterItem));
$("#reset-quote").addEventListener("click", () => {
  if (!confirm("Reset this quote? Your saved pricing will not be changed.")) return;
  quote = { customer: "", items: [createShutterItem()] };
  elements.customer.value = "";
  persistQuote();
  renderItems();
  scrollTo({ top: 0, behavior: "smooth" });
});

function showView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    const active = view.id === `${viewName}-view`;
    view.hidden = !active;
    view.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("is-active", active);
    active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
  });
  elements.stickyTotal.hidden = viewName !== "calculator";
  history.replaceState(null, "", `#${viewName}`);
  scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));

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

renderItems();
if (location.hash === "#settings") showView("settings");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
