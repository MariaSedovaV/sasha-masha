const THEME_KEY = "sasha-theme";
const LOCAL_KEY = "sasha-masha-remont";
const BUDGET = 4000000;

let items = [];
let filterRoom = "";
let saveTimer = 0;
let syncReady = false;

function $(id) {
  return document.getElementById(id);
}

function uid() {
  return "r-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const btn = $("theme-toggle");
  if (btn) btn.textContent = theme === "light" ? "Тёмная" : "Светлая";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f3eee4" : "#0b0c10");
}

function rooms() {
  return window.REMONT_ROOMS || [];
}

function splitQty(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { qty: s || "1", unit: "шт" };
  return { qty: m[1], unit: (m[2] || "шт").trim() || "шт" };
}

function parseAmount(value) {
  const raw = String(value || "").replace(/\s/g, "").replace(",", ".");
  if (!raw) return 0;
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(n) {
  if (!Number.isFinite(n) || !n) return "";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace(".", ",");
}

function lineTotal(row) {
  const q = parseAmount(row?.qty);
  const p = parseAmount(row?.unitPrice);
  if (q > 0 && p > 0) return q * p;
  return 0;
}

function rowSum(row) {
  return lineTotal(row) || parseAmount(row?.price);
}

function seedItems() {
  return (window.REMONT_SEED || []).map((row, i) => {
    const parts = splitQty(row.qty);
    return {
      id: row.id,
      room: row.room,
      name: row.name,
      qty: parts.qty,
      unit: parts.unit,
      unitPrice: "",
      link: "",
      price: "",
      bought: false,
      deleted: false,
      at: i + 1,
      updatedAt: 1,
    };
  });
}

function normalizeItem(row) {
  if (!row || row.id == null) return null;
  const rawQty = String(row.qty || "");
  const hasUnit = String(row.unit || "").trim() !== "";
  const combined = /[^\d\s.,]/.test(rawQty);
  const parts = splitQty(rawQty);
  const qty = combined || !hasUnit ? parts.qty : rawQty.trim() || parts.qty;
  const unit = hasUnit ? String(row.unit).trim() : parts.unit;
  const price = row.price == null ? "" : String(row.price);
  let unitPrice = row.unitPrice == null || row.unitPrice === "" ? "" : String(row.unitPrice);
  if (!unitPrice && parseAmount(price) && parseAmount(qty)) {
    unitPrice = formatAmount(parseAmount(price) / parseAmount(qty));
  }
  const item = {
    id: String(row.id),
    room: String(row.room || ""),
    name: String(row.name || ""),
    qty,
    unit,
    unitPrice,
    link: String(row.link || ""),
    price,
    bought: !!row.bought,
    deleted: !!row.deleted,
    at: Number(row.at || 0),
    updatedAt: Number(row.updatedAt || row.at || 0),
  };
  const calc = lineTotal(item);
  if (calc) item.price = formatAmount(calc);
  return item;
}

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    if (Array.isArray(raw)) return raw.map(normalizeItem).filter(Boolean);
    if (Array.isArray(raw?.items)) return raw.items.map(normalizeItem).filter(Boolean);
  } catch {}
  return [];
}

function writeLocal(list) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch {}
}

function cloudItems() {
  try {
    const snap = window.SashaCloud && window.SashaCloud.snapshot && window.SashaCloud.snapshot();
    if (Array.isArray(snap?.remont)) return snap.remont.map(normalizeItem).filter(Boolean);
  } catch {}
  return [];
}

function mergeById(a, b) {
  const map = new Map();
  for (const item of [...a, ...b]) {
    if (!item) continue;
    const prev = map.get(item.id);
    if (!prev || Number(item.updatedAt || 0) >= Number(prev.updatedAt || 0)) map.set(item.id, item);
  }
  return [...map.values()].sort((x, y) => Number(x.at || 0) - Number(y.at || 0));
}

function loadItems() {
  const local = readLocal();
  const cloud = cloudItems();
  let list = mergeById(local, cloud);
  if (!list.some((row) => !row.deleted)) list = mergeById(seedItems(), list);
  items = list;
  writeLocal(items);
}

function persist(pushCloud) {
  writeLocal(items);
  if (!pushCloud || !window.SashaCloud || typeof window.SashaCloud.setRemont !== "function") return;
  window.SashaCloud.setRemont(items);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  writeLocal(items);
  saveTimer = setTimeout(() => persist(true), 280);
}

function visible() {
  return items.filter((row) => !row.deleted && (!filterRoom || row.room === filterRoom));
}

function money(n) {
  return Math.round(n).toLocaleString("ru-RU") + " ₽";
}

function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}

function updateTotals() {
  const alive = items.filter((row) => !row.deleted);
  const bought = alive.filter((row) => row.bought);
  const boughtSum = bought.reduce((sum, row) => sum + rowSum(row), 0);
  const filledSum = alive.reduce((sum, row) => sum + rowSum(row), 0);
  $("sum-bought").textContent = money(boughtSum);
  $("sum-bought-count").textContent = bought.length + " " + plural(bought.length, "позиция", "позиции", "позиций");
  $("sum-filled").textContent = money(filledSum);
  $("sum-left").textContent = "осталось " + money(Math.max(0, BUDGET - boughtSum));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function renderFilters() {
  const root = $("filters");
  if (!root) return;
  root.innerHTML = rooms().map((room) => {
    const on = filterRoom === room ? " on" : "";
    return `<button type="button" class="filter-chip${on}" data-room="${escapeHtml(room)}">${escapeHtml(room)}</button>`;
  }).join("");
}

function currentTab() {
  const hash = (location.hash || "").replace("#", "");
  return hash === "материалы" || hash === "materials" ? "media" : "list";
}

function showTab(tab) {
  const list = tab !== "media";
  const paneList = $("pane-list");
  const paneMedia = $("pane-media");
  if (paneList) paneList.hidden = !list;
  if (paneMedia) paneMedia.hidden = list;
  document.querySelectorAll(".page-tab").forEach((btn) => {
    const on = btn.dataset.tab === (list ? "list" : "media");
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const next = list ? "" : "#материалы";
  if ((location.hash || "") !== next) history.replaceState(null, "", next || location.pathname + location.search);
  document.body.classList.toggle("is-list", list);
  document.body.classList.toggle("is-media", !list);
}

function renderTable() {
  const active = document.activeElement;
  const activeId = active && active.dataset ? active.dataset.id : "";
  const activeField = active && active.dataset ? active.dataset.field : "";
  const selStart = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
  const selEnd = active && typeof active.selectionEnd === "number" ? active.selectionEnd : null;

  const rows = visible();
  $("table-body").innerHTML = rows.map((row) => {
    const total = rowSum(row);
    return `
    <tr data-id="${escapeHtml(row.id)}" class="${row.bought ? "bought-row" : ""}">
      <td class="cell-room">
        <input class="cell-input" data-id="${escapeHtml(row.id)}" data-field="room" list="room-list" value="${escapeHtml(row.room)}" aria-label="Комната" />
      </td>
      <td class="cell-name-wrap">
        <input class="cell-input cell-name" data-id="${escapeHtml(row.id)}" data-field="name" value="${escapeHtml(row.name)}" aria-label="Предмет или материал" />
      </td>
      <td class="cell-qty" data-label="Кол-во">
        <input class="cell-input" data-id="${escapeHtml(row.id)}" data-field="qty" value="${escapeHtml(row.qty)}" inputmode="decimal" aria-label="Количество" />
      </td>
      <td class="cell-unit" data-label="Ед. изм.">
        <input class="cell-input" data-id="${escapeHtml(row.id)}" data-field="unit" list="unit-list" value="${escapeHtml(row.unit || "шт")}" aria-label="Единица измерения" />
      </td>
      <td class="cell-link">
        <input class="cell-input" data-id="${escapeHtml(row.id)}" data-field="link" value="${escapeHtml(row.link)}" placeholder="https://" inputmode="url" aria-label="Ссылка" />
      </td>
      <td class="cell-unit-price" data-label="Цена за ед.">
        <input class="cell-input" data-id="${escapeHtml(row.id)}" data-field="unitPrice" value="${escapeHtml(row.unitPrice)}" placeholder="₽" inputmode="decimal" aria-label="Цена за единицу" />
      </td>
      <td class="cell-total" data-label="Стоимость">
        <span class="cell-sum" data-total="${escapeHtml(row.id)}">${total ? money(total) : "—"}</span>
      </td>
      <td class="bought-box">
        <input type="checkbox" data-id="${escapeHtml(row.id)}" data-field="bought" ${row.bought ? "checked" : ""} aria-label="Куплено" />
      </td>
      <td class="cell-del">
        <button type="button" class="del-btn" data-del="${escapeHtml(row.id)}" aria-label="Удалить">×</button>
      </td>
    </tr>
  `;
  }).join("");

  if (activeId && activeField) {
    const next = document.querySelector(`[data-id="${CSS.escape(activeId)}"][data-field="${CSS.escape(activeField)}"]`);
    if (next) {
      next.focus();
      if (selStart != null && typeof next.setSelectionRange === "function" && next.type !== "checkbox") {
        try { next.setSelectionRange(selStart, selEnd); } catch {}
      }
    }
  }
  updateTotals();
}

function findItem(id) {
  return items.find((row) => row.id === id);
}

function paintRowTotal(id) {
  const row = findItem(id);
  if (!row) return;
  const total = rowSum(row);
  const el = document.querySelector(`[data-total="${CSS.escape(id)}"]`);
  if (el) el.textContent = total ? money(total) : "—";
}

function patchItem(id, field, value) {
  const row = findItem(id);
  if (!row) return;
  if (field === "bought") row.bought = !!value;
  else row[field] = value;
  if (field === "qty" || field === "unitPrice") {
    const calc = lineTotal(row);
    row.price = calc ? formatAmount(calc) : "";
    paintRowTotal(id);
  }
  row.updatedAt = Date.now();
  scheduleSave();
  updateTotals();
  const tr = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
  if (tr) tr.classList.toggle("bought-row", row.bought);
}

function addRow() {
  const now = Date.now();
  items.push({
    id: uid(),
    room: filterRoom || "Кухня-гостиная",
    name: "",
    qty: "1",
    unit: "шт",
    unitPrice: "",
    link: "",
    price: "",
    bought: false,
    deleted: false,
    at: now,
    updatedAt: now,
  });
  persist(true);
  renderTable();
  const last = $("table-body").querySelector("tr:last-child [data-field='name']");
  if (last) last.focus();
}

function deleteRow(id) {
  const row = findItem(id);
  if (!row) return;
  row.deleted = true;
  row.updatedAt = Date.now();
  persist(true);
  renderTable();
}

function boot() {
  applyTheme(currentTheme());
  $("theme-toggle").addEventListener("click", () => {
    applyTheme(currentTheme() === "light" ? "dark" : "light");
  });

  $("room-list").innerHTML = rooms().map((room) => `<option value="${escapeHtml(room)}"></option>`).join("");
  renderFilters();
  $("filters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-room]");
    if (!btn) return;
    const next = btn.dataset.room || "";
    filterRoom = filterRoom === next ? "" : next;
    renderFilters();
    renderTable();
  });

  document.querySelectorAll(".page-tab").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });
  window.addEventListener("hashchange", () => showTab(currentTab()));
  window.sashaRemontShowTab = showTab;
  $("reset-filters").addEventListener("click", () => {
    filterRoom = "";
    renderFilters();
    renderTable();
  });
  $("add-row").addEventListener("click", addRow);
  $("table-body").addEventListener("input", (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.id || !el.dataset.field || el.type === "checkbox") return;
    patchItem(el.dataset.id, el.dataset.field, el.value);
  });
  $("table-body").addEventListener("change", (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.id) return;
    if (el.dataset.field === "bought") patchItem(el.dataset.id, "bought", el.checked);
  });
  $("table-body").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    deleteRow(btn.dataset.del);
  });

  loadItems();
  renderTable();
  showTab(currentTab());

  window.sashaRemontReload = function () {
    const focused = document.activeElement && document.activeElement.classList.contains("cell-input");
    items = mergeById(items, cloudItems());
    writeLocal(items);
    syncReady = true;
    if (!focused) renderTable();
    else updateTotals();
  };

  if (window.SashaCloud && typeof window.SashaCloud.subscribe === "function") {
    window.SashaCloud.subscribe(() => window.sashaRemontReload());
  }
  setTimeout(() => {
    items = mergeById(items, cloudItems());
    if (!items.some((row) => !row.deleted)) items = mergeById(seedItems(), items);
    persist(true);
    syncReady = true;
    renderTable();
  }, 700);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
