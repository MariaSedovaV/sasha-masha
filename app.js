const THEME_KEY = "sasha-theme";
const GOALS_KEY = "sasha-masha-goals";
const START = new Date(2023, 6, 1, 0, 0, 0);
const GOAL_TONES = ["rose", "sage", "gold", "sky"];
const DEFAULT_GOALS = [
  {
    id: "g1",
    when: "до 2027",
    title: "Счастливо выйти замуж / жениться",
    text: "Перестать ссориться по мелочам. У нас всё хорошо! Все живы и здоровы, а остальное поправимо, всё можно решить.",
    tone: "rose",
  },
  {
    id: "g2",
    when: "до Q3 2027",
    title: "Квартира на Тосина с ремонтом",
    text: "Мы переезжаем в свою квартиру!!",
    tone: "sage",
  },
  {
    id: "g3",
    when: "до 2028",
    title: "Первый ребёнок",
    text: "Какое счастье!",
    tone: "gold",
  },
  {
    id: "g4",
    when: "до 2029",
    title: "Саша — ГД",
    text: "Или ГД-1, но с внушительным окладом!",
    tone: "sky",
  },
  {
    id: "g5",
    when: "до 2030",
    title: "Квартира в центре / дом за городом / за рубежом",
    text: "Мы так планировали — но пусть случится раньше!",
    tone: "gold",
  },
  {
    id: "g6",
    when: "до 2030",
    title: "Погашенная ипотека на Тосина",
    text: "Теперь можно и второго планировать :))",
    tone: "sage",
  },
];

function $(id) {
  return document.getElementById(id);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

function loadGoals() {
  try {
    const stored = localStorage.getItem(GOALS_KEY);
    if (stored === null) return DEFAULT_GOALS.map((g) => ({ ...g }));
    const raw = JSON.parse(stored);
    if (!Array.isArray(raw)) return DEFAULT_GOALS.map((g) => ({ ...g }));
    return raw.map((g, i) => ({
      id: g.id || uid(),
      when: String(g.when || "").trim(),
      title: String(g.title || "").trim(),
      text: String(g.text || "").trim(),
      tone: GOAL_TONES.includes(g.tone) ? g.tone : GOAL_TONES[i % GOAL_TONES.length],
    })).filter((g) => g.title);
  } catch {
    return DEFAULT_GOALS.map((g) => ({ ...g }));
  }
}

function saveGoals(list) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(list));
}

function renderGoals() {
  const root = $("timeline");
  if (!goals.length) {
    root.innerHTML = `<li class="goals-empty">Пока пусто. Добавьте первую цель — и она останется на этой нити.</li>`;
    return;
  }
  root.innerHTML = goals.map((g) => `
    <li class="node node-${escapeHtml(g.tone)}" data-id="${escapeHtml(g.id)}">
      <div class="node-when">${escapeHtml(g.when)}</div>
      <div class="node-card">
        <button type="button" class="goal-del" data-del="${escapeHtml(g.id)}" aria-label="Удалить цель">×</button>
        <h3>${escapeHtml(g.title)}</h3>
        ${g.text ? `<p>${escapeHtml(g.text)}</p>` : ""}
      </div>
    </li>
  `).join("");
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

function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}

function elapsed() {
  const now = new Date();
  let years = now.getFullYear() - START.getFullYear();
  const anniversary = new Date(START);
  anniversary.setFullYear(START.getFullYear() + years);
  if (now < anniversary) {
    years -= 1;
    anniversary.setFullYear(START.getFullYear() + years);
  }
  let ms = now - anniversary;
  const days = Math.floor(ms / 86400000);
  ms -= days * 86400000;
  const hours = Math.floor(ms / 3600000);
  ms -= hours * 3600000;
  const minutes = Math.floor(ms / 60000);
  ms -= minutes * 60000;
  const seconds = Math.floor(ms / 1000);
  return { years, days, hours, minutes, seconds };
}

function renderClock() {
  const t = elapsed();
  const units = [
    [t.years, plural(t.years, "год", "года", "лет")],
    [t.days, plural(t.days, "день", "дня", "дней")],
    [t.hours, plural(t.hours, "час", "часа", "часов")],
    [t.minutes, plural(t.minutes, "минута", "минуты", "минут")],
    [t.seconds, plural(t.seconds, "секунда", "секунды", "секунд")],
  ];
  $("clock-units").innerHTML = units
    .map(([value, label]) => `<div class="clock-unit"><b>${value}</b><span>${label}</span></div>`)
    .join("");
}

function showGoals(on) {
  $("hub-view").classList.toggle("hidden", on);
  $("goals-view").classList.toggle("hidden", !on);
  $("goals-view").hidden = !on;
  document.body.classList.toggle("on-goals", on);
  history.replaceState(null, "", on ? "#цели" : location.pathname);
  if (on) window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

const goals = loadGoals();
applyTheme(currentTheme());
renderGoals();

$("theme-toggle").addEventListener("click", () => {
  applyTheme(currentTheme() === "light" ? "dark" : "light");
});
$("open-goals").addEventListener("click", () => showGoals(true));
$("back-hub").addEventListener("click", () => showGoals(false));

$("goal-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const when = String(data.get("when") || "").replace(/\s+/g, " ").trim();
  const title = String(data.get("title") || "").replace(/\s+/g, " ").trim();
  const text = String(data.get("text") || "").replace(/\s+/g, " ").trim();
  if (!when || !title) return;
  goals.push({
    id: uid(),
    when,
    title,
    text,
    tone: GOAL_TONES[goals.length % GOAL_TONES.length],
  });
  saveGoals(goals);
  renderGoals();
  e.target.reset();
  $("goal-form").elements.when.focus();
});

$("timeline").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-del]");
  if (!btn) return;
  if (!btn.classList.contains("armed")) {
    $("timeline").querySelectorAll(".goal-del.armed").forEach((b) => {
      b.classList.remove("armed");
      b.textContent = "×";
    });
    btn.classList.add("armed");
    btn.textContent = "да";
    return;
  }
  const id = btn.dataset.del;
  const i = goals.findIndex((g) => g.id === id);
  if (i >= 0) goals.splice(i, 1);
  saveGoals(goals);
  renderGoals();
});

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-del]")) return;
  $("timeline")?.querySelectorAll(".goal-del.armed").forEach((b) => {
    b.classList.remove("armed");
    b.textContent = "×";
  });
});

if (location.hash === "#цели" || location.hash === "#goals") showGoals(true);

renderClock();
setInterval(renderClock, 1000);
