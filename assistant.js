const NOTES_KEY = "sasha-masha-notes";
const BUDGET_ADDS_KEY = "sasha-masha-budget-adds";
const LINKS = {
  budget: "https://mariasedovav.github.io/sasha-masha-budget/",
  pitanie: "https://mariasedovav.github.io/sasha-masha-pitanie/",
  zametki: "https://mariasedovav.github.io/sasha-masha-zametki/",
};

const MONTHS_RU = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];

const EXPENSE_CATS = [
  ["Ипотека платеж", ["ипотека"]],
  ["Дедушка долг", ["дедушка", "долг дедушки"]],
  ["Ремонт квартиры", ["ремонт"]],
  ["Квартира Тайланд", ["тайланд", "таиланд"]],
  ["Свадебное путешествие", ["свадебн", "медовый"]],
  ["Саша учеба", ["учеба", "учёба"]],
  ["Парковка", ["абонемент парков", "парковка маши"]],
  ["Отпуска", ["отпуск"]],
  ["Страховка", ["страхов"]],
  ["Налоги", ["налог"]],
  ["Ребенок", ["ребенок", "ребёнок", "дети"]],
  ["Супермаркеты", ["супермаркет", "продукт", "пятероч", "магнит", "перекрёст", "перекрест", "вкусвилл", "еда"]],
  ["Такси", ["такси", "яндекс го", "uber", "каршеринг"]],
  ["Рестораны", ["ресторан", "кафе", "кофе", "обед", "ужин"]],
  ["Одежда и обувь", ["одежд", "обув", "платье", "кроссов"]],
  ["Квартплата", ["квартплат", "жкх", "коммунал"]],
  ["Мобильная связь", ["связь", "мтс", "мегафон", "билайн", "теле2", "мобильн"]],
  ["Товары для дома", ["дом", "ikea", "икеа", "хоз"]],
  ["Косметика", ["косметик"]],
  ["Развлечения", ["развлеч", "кино", "театр", "концерт"]],
  ["Бьюти процедуры", ["бьюти", "маникюр", "стрижк", "салон"]],
  ["Парковки и штрафы", ["штраф", "парковк"]],
  ["Бензин", ["бензин", "заправк"]],
  ["Переводы", ["перевод"]],
  ["Прочее", ["прочее", "разное"]],
  ["Расходы на семьи", ["семьи", "родител"]],
  ["Подарки друг другу", ["подарок", "подарки"]],
  ["Крупные покупки", ["крупн", "техник"]],
  ["Абонемент в спорт-зал", ["спорт", "зал", "фитнес"]],
];

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function currentMonth() {
  return new Date().getMonth() + 1;
}

function monthName(n) {
  return ["январе","феврале","марте","апреле","мае","июне","июле","августе","сентябре","октябре","ноябре","декабре"][n - 1];
}

function parseAmount(text) {
  const raw = norm(text);
  let m = raw.match(/(\d[\d\s]{0,12}\d|\d+)\s*(?:тыс|к\b)/);
  if (m) return Number(String(m[1]).replace(/\s/g, "")) * 1000;
  m = raw.match(/(\d[\d\s]{0,12}\d|\d+)\s*(?:руб|р |₽)?/);
  if (m) return Number(String(m[1]).replace(/\s/g, ""));
  return null;
}

function matchCategory(text) {
  const n = norm(text);
  let best = null;
  let bestLen = 0;
  for (const [name, aliases] of EXPENSE_CATS) {
    const keys = [norm(name), ...aliases];
    for (const key of keys) {
      if (key && n.includes(key) && key.length >= bestLen) {
        best = name;
        bestLen = key.length;
      }
    }
  }
  return best;
}

function loadNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTES_KEY) || "null");
    return {
      sasha: Array.isArray(raw?.sasha) ? raw.sasha : [],
      masha: Array.isArray(raw?.masha) ? raw.masha : [],
    };
  } catch {
    return { sasha: [], masha: [] };
  }
}

function addNote(person, text) {
  const notes = loadNotes();
  notes[person].push({ id: uid(), text, done: false, at: Date.now() });
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function addExpense(category, amount) {
  const month = currentMonth();
  const year = new Date().getFullYear();
  let list = [];
  try { list = JSON.parse(localStorage.getItem(BUDGET_ADDS_KEY) || "[]"); } catch {}
  if (!Array.isArray(list)) list = [];
  list.push({ id: uid(), year, month, category, amount, at: Date.now() });
  localStorage.setItem(BUDGET_ADDS_KEY, JSON.stringify(list));
  return { month, year };
}

function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ru-RU";
    u.rate = 1.02;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

function handleCommand(raw) {
  const text = String(raw || "").trim();
  const n = norm(text);
  if (!n) return { say: "Скажите ещё раз — я не расслышала." };

  if (/(помощ|умеешь|сценари|что можешь|help)/.test(n)) {
    return {
      say: "Могу открыть бюджет, питание, заметки или цели. Добавить дело Саше или Маше. Записать трату в категорию этого месяца. Интернет сама не ищу — но могу открыть поиск Яндекса.",
    };
  }

  if (/(найди|погугли|поиск|что такое|кто такой|загугли)/.test(n)) {
    const q = text.replace(/^(найди|погугли|поиск|что такое|кто такой|загугли)\s+/i, "").trim() || text;
    return {
      say: "Сама в интернет не хожу. Открыла поиск Яндекса — там уже можно посмотреть.",
      search: q,
    };
  }

  if (/(бюджет|мониторинг|деньг|финанс|fcf)/.test(n)) {
    return { say: "Открываю мониторинг бюджета.", open: LINKS.budget };
  }
  if (/(питани|еда|рацион|меню|рецепт)/.test(n)) {
    return { say: "Открываю питание.", open: LINKS.pitanie };
  }
  if (/(заметк|список дел|туду|todo)/.test(n) && !/(добав|запиш|напомн)/.test(n)) {
    return { say: "Открываю заметки.", open: LINKS.zametki };
  }
  if (/(цел[иь]|горизонт|желани)/.test(n) && !/(добав|новую цель)/.test(n)) {
    return { say: "Открываю цели.", goals: true };
  }
  if (/(домой|главн|экосистем|лендинг)/.test(n)) {
    return { say: "Возвращаю на главную.", home: true };
  }
  if (/(светл(ая|ую) тем|темн(ая|ую) тем|переключ.*тем)/.test(n)) {
    return { say: "Переключаю тему.", theme: true };
  }

  const person = /(маше|маши|для маши|маше)\b/.test(n)
    ? "masha"
    : /(саше|саши|для саши)\b/.test(n)
      ? "sasha"
      : null;
  const wantsTask = /(дело|задач|напомн|запиш|добав)/.test(n);
  if (person && (wantsTask || /^(маше|саше)\b/.test(n))) {
    let task = text
      .replace(/^(пожалуйста|давай|можешь)\s+/i, "")
      .replace(/^(добавь|запиши|напомни|поставь)\s+(дело\s+)?/i, "")
      .replace(/^(дело\s+)?(маше|маши|саше|саши|для маши|для саши)\s*[:\-–]?\s*/i, "")
      .replace(/^(маше|саше)\s+/i, "")
      .trim();
    if (!task || task.length < 2) {
      return { say: person === "masha" ? "Какое дело добавить Маше?" : "Какое дело добавить Саше?" };
    }
    addNote(person, task);
    const who = person === "masha" ? "Маше" : "Саше";
    return { say: `Добавила дело ${who}: «${task}». Оно уже в заметках.`, open: LINKS.zametki };
  }

  const amount = parseAmount(text);
  const cat = matchCategory(text);
  const wantsMoney = /(добав|запиш|потрат|трат|затрат|минус|списал)/.test(n) || (amount && cat);
  if (wantsMoney && amount && cat) {
    const { month } = addExpense(cat, amount);
    return {
      say: `Записала ${amount.toLocaleString("ru-RU")} ₽ в «${cat}» за ${monthName(month)}. Сумма появится в факте на вкладке «Данные» в бюджете.`,
      open: LINKS.budget,
    };
  }
  if (wantsMoney && amount && !cat) {
    return { say: `Сумму ${amount.toLocaleString("ru-RU")} ₽ услышала. В какую категорию записать — такси, рестораны, супермаркеты?` };
  }
  if (wantsMoney && cat && !amount) {
    return { say: `Категория «${cat}» есть. Назовите сумму цифрами.` };
  }

  return {
    say: "Не расслышала сценарий. Можно: «открой бюджет», «добавь Маше купить молоко», «запиши 1500 в такси».",
  };
}

function bootAssistant() {
  const panel = document.getElementById("assist-panel");
  const log = document.getElementById("assist-log");
  const form = document.getElementById("assist-form");
  const input = document.getElementById("assist-input");
  const mic = document.getElementById("assist-mic");
  const openBtn = document.getElementById("assist-open");
  const closeBtn = document.getElementById("assist-close");
  if (!panel || !form) return;

  function addMsg(role, text) {
    const el = document.createElement("div");
    el.className = `assist-msg ${role}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function run(text, fromVoice) {
    addMsg("user", text);
    const res = handleCommand(text);
    addMsg("bot", res.say);
    if (fromVoice) speak(res.say);
    if (res.theme) {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.getElementById("theme-toggle")?.click();
      if (!document.getElementById("theme-toggle")) {
        document.documentElement.dataset.theme = next;
        localStorage.setItem("sasha-theme", next);
      }
    }
    if (res.goals) document.getElementById("open-goals")?.click();
    if (res.home) document.getElementById("back-hub")?.click();
    if (res.search) {
      window.open("https://yandex.ru/search/?text=" + encodeURIComponent(res.search), "_blank", "noopener");
    }
    if (res.open) setTimeout(() => { location.href = res.open; }, 700);
  }

  openBtn.addEventListener("click", () => {
    panel.classList.remove("hidden");
    panel.hidden = false;
    openBtn.classList.add("hidden");
    if (!log.childElementCount) {
      addMsg("bot", "Привет. Могу открыть разделы, добавить дело Саше или Маше и записать трату в категорию этого месяца. Зажмите кнопку и говорите — или напишите.");
    }
    input.focus();
  });
  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
    panel.hidden = true;
    openBtn.classList.remove("hidden");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    run(text, false);
  });

  document.querySelectorAll("[data-assist]").forEach((chip) => {
    chip.addEventListener("click", () => run(chip.dataset.assist, false));
  });

  const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let holding = false;
  let buffer = "";

  function stopListen() {
    holding = false;
    mic.classList.remove("holding");
    mic.textContent = "Зажать и говорить";
    try { rec && rec.stop(); } catch {}
  }

  function startListen() {
    if (!SpeechAPI) {
      addMsg("bot", "Голос в этом браузере недоступен. Напишите командой — или откройте Chrome.");
      return;
    }
    holding = true;
    buffer = "";
    mic.classList.add("holding");
    mic.textContent = "Слушаю…";
    rec = new SpeechAPI();
    rec.lang = "ru-RU";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      let out = "";
      for (let i = 0; i < event.results.length; i += 1) out += event.results[i][0].transcript;
      buffer = out.trim();
      input.value = buffer;
    };
    rec.onerror = () => stopListen();
    rec.onend = () => {
      mic.classList.remove("holding");
      mic.textContent = "Зажать и говорить";
      if (holding) return;
      const said = (buffer || input.value).trim();
      if (said) {
        input.value = "";
        run(said, true);
      }
    };
    try { rec.start(); } catch { stopListen(); }
  }

  const holdStart = (e) => {
    e.preventDefault();
    mic.setPointerCapture?.(e.pointerId);
    startListen();
  };
  const holdEnd = (e) => {
    e.preventDefault();
    stopListen();
  };
  mic.addEventListener("pointerdown", holdStart);
  mic.addEventListener("pointerup", holdEnd);
  mic.addEventListener("pointercancel", holdEnd);
}

document.addEventListener("DOMContentLoaded", bootAssistant);
