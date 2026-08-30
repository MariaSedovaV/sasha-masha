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

function seedItems() {
  return (window.REMONT_SEED || []).map((row, i) => ({
    id: row.id,
    room: row.room,
    name: row.name,
    qty: row.qty,
    link: "",
    price: "",
    bought: false,
    deleted: false,
    at: i + 1,
    updatedAt: 1,
  }));
}

function normalizeItem(row) {
  if (!row || row.id == null) return null;
  return {
    id: String(row.id),
    room: String(row.room || ""),
    name: String(row.name || ""),
    qty: String(row.qty || ""),
    link: String(row.link || ""),
    price: row.price == null ? "" : String(row.price),
    bought: !!row.bought,
    deleted: !!row.deleted,
    at: Number(row.at || 0),
    updatedAt: Number(row.updatedAt || row.at || 0),
  };
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

function parsePrice(value) {
  const raw = String(value || "").replace(/\s/g, "").replace(",", ".");
  if (!raw) return 0;
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
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
  const boughtSum = bought.reduce((sum, row) => sum + parsePrice(row.price), 0);
  const filledSum = alive.reduce((sum, row) => sum + parsePrice(row.price), 0);
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
  const chips = ["", ...rooms()];
  root.innerHTML = chips.map((room) => {
    const label = room || "Все комнаты";
    const on = filterRoom === room ? " on" : "";
    return `<button type="button" class="filter-chip${on}" data-room="${escapeHtml(room)}">${escapeHtml(label)}</button>`;
  }).join("");
}

function renderTable() {
  const active = document.activeElement;
  const activeId = active && active.dataset ? active.dataset.id : "";
  const activeField = active && active.dataset ? active.dataset.field : "";
  const selStart = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
  const selEnd = active && typeof active.selectionEnd === "number" ? active.selectionEnd : null;

  const rows = visible();
  $("table-body").innerHTML = rows.map((row) => `
    <tr data-id="${escapeHtml(row.id)}" class="${row.bought ? "bought-row" : ""}">
      <td>
        <input class="cell-input" data-id="${escapeHtml(row.id)}" data-field="room" list="room-list" value="${escapeHtml(row.room)}" aria-label="Комната" />
      </td>
      <td>
        <input class="cell-input cell-name" data-id="${escapeHtml(row.id)}" data-field="name" value="${escapeHtml(row.name)}" aria-label="Предмет или материал" />
      </td>
      <td>
        <input class="cell-input" data-id="${escapeHtml(row.id)}" data-field="qty" value="${escapeHtml(row.qty)}" aria-label="Количество" />
      </td>
      <td>
        <input class="cell-input" data-id="${escapeHtml(row.id)}" data-field="link" value="${escapeHtml(row.link)}" placeholder="https://" inputmode="url" aria-label="Ссылка" />
      </td>
      <td>
        <input class="cell-input" data-id="${escapeHtml(row.id)}" data-field="price" value="${escapeHtml(row.price)}" placeholder="₽" inputmode="decimal" aria-label="Стоимость" />
      </td>
      <td class="bought-box">
        <input type="checkbox" data-id="${escapeHtml(row.id)}" data-field="bought" ${row.bought ? "checked" : ""} aria-label="Куплено" />
      </td>
      <td>
        <button type="button" class="del-btn" data-del="${escapeHtml(row.id)}" aria-label="Удалить">×</button>
      </td>
    </tr>
  `).join("");

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

function patchItem(id, field, value) {
  const row = findItem(id);
  if (!row) return;
  if (field === "bought") row.bought = !!value;
  else row[field] = value;
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
    qty: "1 шт",
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

function setSyncLine() {
  const el = $("sync-line");
  if (!el) return;
  const status = window.SashaCloud && typeof window.SashaCloud.status === "function"
    ? window.SashaCloud.status()
    : null;
  if (status && status.ok) {
    el.textContent = "Облако включено: правки с телефона и ноутбука сходятся в одну таблицу.";
    return;
  }
  if (status && status.error) {
    el.textContent = "Пока только на этом устройстве. Облако ещё подключается…";
    return;
  }
  el.textContent = syncReady
    ? "Сверяем таблицу с облаком…"
    : "Сначала сохраняем на этом устройстве, облако подключается…";
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
    filterRoom = btn.dataset.room || "";
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
  setSyncLine();

  window.sashaRemontReload = function () {
    const focused = document.activeElement && document.activeElement.classList.contains("cell-input");
    items = mergeById(items, cloudItems());
    writeLocal(items);
    syncReady = true;
    setSyncLine();
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
    setSyncLine();
    renderTable();
  }, 700);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
