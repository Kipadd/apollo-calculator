import {
  UNIT_INCHES,
  UNIT_METRES,
  calculateQuote,
  convertItemMeasurements,
  formatMeasurementInput,
  normalizeUnit,
  parseDecimal
} from "./calculator.js";

const SETTINGS_KEY = "shutters-calculator-settings-v1";
const QUOTE_KEY = "shutters-calculator-quote-v1";
const defaults = { woodPrice: 0, pvcPrice: 0, surcharge: 25 };

const createItem = () => ({
  id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  name: "", width: "", height: "", unit: UNIT_INCHES, material: "wood", tilt: "standard"
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
const storedQuote = readStored(QUOTE_KEY, { customer: "", items: [createItem()] });
let quote = {
  customer: typeof storedQuote.customer === "string" ? storedQuote.customer : "",
  items: Array.isArray(storedQuote.items)
    ? storedQuote.items.map((item) => ({ ...createItem(), ...item, unit: normalizeUnit(item?.unit ?? storedQuote.unit) }))
    : [createItem()]
};

const $ = (selector, root = document) => root.querySelector(selector);
const elements = {
  customer: $("#customer"), items: $("#items-list"), template: $("#item-template"),
  countBadge: $("#item-count-badge"), summaryItems: $("#summary-items"), summaryArea: $("#summary-area"),
  summarySubtotal: $("#summary-subtotal"), summarySurcharge: $("#summary-surcharge"), summaryTotal: $("#summary-total"),
  stickyTotal: $("#sticky-total"), stickyValue: $("#sticky-total-value"), settingsForm: $("#settings-form"),
  woodPrice: $("#wood-price"), pvcPrice: $("#pvc-price"), tiltSurcharge: $("#tilt-surcharge"),
  settingsError: $("#settings-error"), saveFeedback: $("#save-feedback")
};

const money = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value) => money.format(Number.isFinite(value) ? value : 0).replace(/\s/g, "");
const formatMeasure = (value, unit) => Number.isFinite(value) ? `${value.toFixed(3)} ${unit}` : "—";
const persistQuote = () => localStorage.setItem(QUOTE_KEY, JSON.stringify(quote));
const persistSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

function itemMarkup(item, index) {
  const fragment = elements.template.content.cloneNode(true);
  const card = $(".item-card", fragment);
  card.dataset.id = item.id;
  $(".item-number", card).textContent = index + 1;
  const nameInput = $(".item-name", card);
  nameInput.value = item.name;
  nameInput.id = `item-name-${item.id}`;
  $(".item-name-field label", card).htmlFor = nameInput.id;
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

function renderItems() {
  elements.items.replaceChildren(...quote.items.map(itemMarkup));
  updateCalculations();
}

function setResult(card, selector, value) {
  $(selector, card).textContent = value;
}

function updateCalculations() {
  const summary = calculateQuote(quote.items, settings);
  const surchargeLabel = `+${settings.surcharge.toFixed(0)}%`;
  document.querySelectorAll(".surcharge-label").forEach((label) => { label.textContent = surchargeLabel; });

  summary.results.forEach((result, index) => {
    const card = elements.items.children[index];
    if (!card) return;
    const item = quote.items[index];
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
  });

  const count = quote.items.length;
  elements.countBadge.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  elements.summaryItems.textContent = count;
  elements.summaryArea.textContent = summary.area > 0 ? formatMeasure(summary.area, "m²") : "—";
  elements.summarySubtotal.textContent = formatMoney(summary.subtotal);
  elements.summarySurcharge.textContent = formatMoney(summary.surcharge);
  elements.summaryTotal.textContent = formatMoney(summary.total);
  elements.stickyValue.textContent = formatMoney(summary.total);
}

function addItem() {
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
$("#add-item").addEventListener("click", addItem);
$("#sticky-add").addEventListener("click", addItem);
$("#reset-quote").addEventListener("click", () => {
  if (!confirm("Reset this quote? Your saved pricing will not be changed.")) return;
  quote = { customer: "", items: [createItem()] };
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
