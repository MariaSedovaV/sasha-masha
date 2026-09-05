const THEME_KEY = "sasha-theme";
const START = new Date(2023, 6, 1, 0, 0, 0);

function $(id) {
  return document.getElementById(id);
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

function showView(name) {
  const views = ["hub", "goals", "calendar"];
  views.forEach((v) => {
    const el = $(v + "-view");
    if (!el) return;
    const on = v === name;
    el.classList.toggle("hidden", !on);
    el.hidden = !on;
  });
  document.body.classList.toggle("on-goals", name === "goals");
  document.body.classList.toggle("on-calendar", name === "calendar");
  const hash = name === "goals" ? "#цели" : name === "calendar" ? "#календарь" : location.pathname;
  history.replaceState(null, "", hash);
  if (name !== "hub") window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  if (name === "calendar") window.sashaCalendarReload?.();
}

applyTheme(currentTheme());
$("theme-toggle").addEventListener("click", () => {
  applyTheme(currentTheme() === "light" ? "dark" : "light");
});
$("open-goals").addEventListener("click", () => showView("goals"));
$("open-calendar").addEventListener("click", () => showView("calendar"));
$("back-hub").addEventListener("click", () => showView("hub"));
$("back-hub-cal").addEventListener("click", () => showView("hub"));
$("home-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  showView("hub");
});

if (location.hash === "#цели" || location.hash === "#goals") showView("goals");
else if (location.hash === "#календарь" || location.hash === "#calendar") showView("calendar");

renderClock();
setInterval(renderClock, 1000);
