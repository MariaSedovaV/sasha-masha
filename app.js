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

function viewFromHash() {
  const raw = String(location.hash || "").replace(/^#/, "");
  let h = raw;
  try { h = decodeURIComponent(raw); } catch {}
  h = h.trim().toLowerCase();
  if (h === "цели" || h === "goals") return "goals";
  if (h === "календарь" || h === "calendar") return "calendar";
  return "";
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
  syncBrandPage();
  if (name !== "hub") window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  if (name === "calendar") window.sashaCalendarReload?.();
}

applyTheme(currentTheme());
$("theme-toggle").addEventListener("click", () => {
  applyTheme(currentTheme() === "light" ? "dark" : "light");
});
$("open-goals").addEventListener("click", () => showView("goals"));
$("open-calendar").addEventListener("click", () => showView("calendar"));
$("home-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  showView("hub");
});

if (viewFromHash() === "goals") showView("goals");
else if (viewFromHash() === "calendar") showView("calendar");
window.addEventListener("hashchange", () => {
  const view = viewFromHash();
  if (view) showView(view);
  else showView("hub");
});

renderClock();
setInterval(renderClock, 1000);

function syncBrandPage() {
  const page = document.querySelector(".brand-page");
  if (!page) return;
  if (document.documentElement.dataset.locked === "1") page.textContent = "Вход";
  else if (document.body.classList.contains("on-goals")) page.textContent = "Цели";
  else if (document.body.classList.contains("on-calendar")) page.textContent = "Календарь";
  else page.textContent = "Экосистема";
}

function refreshSessionChrome() {
  const locked = document.documentElement.dataset.locked === "1";
  const session = locked ? null : window.SashaAuth?.session?.();
  const chip = $("session-chip");
  const name = $("session-name");
  const gate = $("gate-view");
  if (chip) {
    chip.hidden = !session;
    chip.classList.toggle("masha", session?.id === "masha");
    chip.classList.toggle("sasha", session?.id === "sasha");
  }
  if (name) name.textContent = session?.name || "";
  if (gate) {
    gate.hidden = !locked;
    gate.classList.toggle("hidden", !locked);
  }
  syncBrandPage();
}

function bindGate() {
  const form = $("gate-form");
  if (!form || !window.SashaAuth) return;

  form.querySelectorAll('input[name="gate-who"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      $("gate-login").value = el.value;
      $("gate-error").textContent = "";
      $("gate-password").focus();
    });
  });

  $("gate-login")?.addEventListener("input", () => {
    const id = window.SashaAuth.normalizeLogin($("gate-login").value);
    form.querySelectorAll('input[name="gate-who"]').forEach((el) => {
      el.checked = el.value === id;
    });
  });

  $("gate-peek")?.addEventListener("click", () => {
    const input = $("gate-password");
    const peek = $("gate-peek");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    peek.textContent = show ? "Скрыть" : "Показать";
    peek.setAttribute("aria-pressed", show ? "true" : "false");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const error = $("gate-error");
    const enter = form.querySelector(".gate-enter");
    error.textContent = "";
    if (enter) enter.disabled = true;
    try {
      const session = await window.SashaAuth.login($("gate-login").value, $("gate-password").value);
      if (!session) {
        error.textContent = "Не тот логин или пароль. Попробуйте ещё раз.";
        form.classList.remove("shake");
        void form.offsetWidth;
        form.classList.add("shake");
        $("gate-password").value = "";
        $("gate-password").focus();
        return;
      }
      window.SashaAuth.setLocked(false);
      $("gate-password").value = "";
      refreshSessionChrome();
    } finally {
      if (enter) enter.disabled = false;
    }
  });

  $("session-out")?.addEventListener("click", () => {
    window.SashaAuth.logout();
    $("gate-password").value = "";
    $("gate-error").textContent = "";
    refreshSessionChrome();
    $("gate-login")?.focus();
  });

  refreshSessionChrome();
  if (document.documentElement.dataset.locked === "1") {
    requestAnimationFrame(() => $("gate-login")?.focus());
  }
}

bindGate();
