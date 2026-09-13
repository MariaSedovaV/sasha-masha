(function (global) {
  const HOME = "https://mariasedovav.github.io/sasha-masha/";
  const LINKS = {
    home: HOME,
    budget: "https://mariasedovav.github.io/sasha-masha-budget/",
    pitanie: "https://mariasedovav.github.io/sasha-masha-pitanie/",
    zametki: "https://mariasedovav.github.io/sasha-masha-zametki/",
    remont: HOME + "remont/",
    goals: HOME + "#цели",
    calendar: HOME + "#календарь",
  };
  const CATS = [
    ["Ипотека платеж", ["ипотека"]],
    ["Дедушка долг", ["дедушка", "долг дедушки"]],
    ["Ремонт квартиры", ["ремонт квартиры", "за ремонт"]],
    ["Квартира Тайланд", ["тайланд", "таиланд"]],
    ["Свадебное путешествие", ["свадебн", "медовый"]],
    ["Саша учеба", ["учеба", "учёба"]],
    ["Парковка", ["абонемент парков", "парковка маши"]],
    ["Отпуска", ["отпуск"]],
    ["Страховка", ["страхов"]],
    ["Налоги", ["налог"]],
    ["Ребенок", ["ребенок", "ребёнок"]],
    ["Супермаркеты", ["супермаркет", "продукт", "пятероч", "магнит", "перекрест", "вкусвилл", "продукты", "еда"]],
    ["Такси", ["такси", "яндекс го", "uber", "каршеринг"]],
    ["Рестораны", ["ресторан", "кафе", "кофе", "обед", "ужин вне"]],
    ["Одежда и обувь", ["одежд", "обув", "платье", "кроссов"]],
    ["Квартплата", ["квартплат", "жкх", "коммунал"]],
    ["Мобильная связь", ["связь", "мтс", "мегафон", "билайн", "теле2", "мобильн"]],
    ["Товары для дома", ["ikeа", "икеа", "хозтовар"]],
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
    ["Абонемент в спорт-зал", ["спортзал", "фитнес", "абонемент в зал"]],
  ];
  const CAT_NAMES = CATS.map((row) => row[0]);
  const MONTHS = [
    ["январ", 1], ["феврал", 2], ["март", 3], ["апрел", 4], ["ма", 5],
    ["июн", 6], ["июл", 7], ["август", 8], ["сентябр", 9], ["сент", 9],
    ["октябр", 10], ["ноябр", 11], ["декабр", 12],
  ];
  const WEEKDAYS = [
    ["воскресень", 0], ["понедельни", 1], ["вторни", 2], ["сред", 3],
    ["четверг", 4], ["пятниц", 5], ["суббот", 6],
  ];
  let pending = null;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function wrap(n) {
    return " " + n + " ";
  }
  function hasWord(n, word) {
    return wrap(n).includes(" " + word + " ");
  }
  function hasAny(n, words) {
    return words.some((w) => hasWord(n, w));
  }
  function hasStem(n, stem) {
    return wrap(n).includes(" " + stem);
  }
  function isTaskHint(n) {
    return ["дел", "задач", "напомн", "запиш", "добав", "купи", "позвон", "запис", "сделай", "сделать", "забери", "отправ", "напиши", "проверь", "оплат", "заказать"].some((s) => hasStem(n, s))
      || hasAny(n, ["надо", "нужно"]);
  }
  function moscowToday() {
    return new Date().toLocaleString("sv-SE", { timeZone: "Europe/Moscow" }).slice(0, 10);
  }
  function addDays(ymd, n) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  }
  function weekdayOf(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }
  function monthName(n) {
    return ["январе","феврале","марте","апреле","мае","июне","июле","августе","сентябре","октябре","ноябре","декабре"][n - 1];
  }
  function prettyDate(ymd) {
    if (!ymd) return "";
    const [y, m, d] = ymd.split("-");
    const names = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    return Number(d) + " " + names[Number(m) - 1];
  }
  function snap() {
    try { return global.SashaCloud?.snapshot?.() || {}; } catch { return {}; }
  }
  function sessionWho() {
    try {
      const id = global.SashaAuth?.session?.()?.id;
      if (id === "sasha" || id === "masha") return id;
    } catch {}
    return "";
  }

  function collectContext() {
    const cloud = snap();
    const notes = cloud.notes || {};
    const open = (list) => (Array.isArray(list) ? list : [])
      .filter((t) => t && !t.deleted && !t.archived && !t.done)
      .slice(-10)
      .map((t) => t.text)
      .filter(Boolean);
    const today = moscowToday();
    const events = (cloud.calendar || [])
      .filter((e) => e && !e.deleted && String(e.date || "") >= today)
      .slice(0, 20)
      .map((e) => ({
        date: e.date,
        title: e.title,
        start: e.start || "",
        who: e.who || "",
      }));
    const plan = cloud.cookingPlan || {};
    return {
      today,
      page: (global.location?.pathname || "") + (global.location?.hash || ""),
      who: sessionWho(),
      ration: plan.title || "",
      tasks: { sasha: open(notes.sasha), masha: open(notes.masha) },
      events,
    };
  }

  function addNote(person, text, due) {
    const cloud = snap();
    const notes = {
      sasha: Array.isArray(cloud.notes?.sasha) ? cloud.notes.sasha.slice() : [],
      masha: Array.isArray(cloud.notes?.masha) ? cloud.notes.masha.slice() : [],
    };
    notes[person] = notes[person] || [];
    notes[person].push({
      id: uid(),
      text,
      done: false,
      at: Date.now(),
      updatedAt: Date.now(),
      author: sessionWho() || person,
      due: due || "",
      details: [],
      archived: false,
      doneAt: 0,
    });
    try { localStorage.setItem("sasha-masha-notes", JSON.stringify(notes)); } catch {}
    if (global.SashaCloud?.setNotes) global.SashaCloud.setNotes(notes);
  }

  function addExpense(category, amount) {
    const month = new Date().getMonth() + 1;
    let list = [];
    try { list = JSON.parse(localStorage.getItem("sasha-masha-budget-adds") || "[]"); } catch {}
    if (!Array.isArray(list)) list = [];
    list.push({
      id: uid(),
      year: new Date().getFullYear(),
      month,
      category,
      amount,
      at: Date.now(),
      updatedAt: Date.now(),
    });
    try { localStorage.setItem("sasha-masha-budget-adds", JSON.stringify(list)); } catch {}
    if (global.SashaCloud?.setBudgetAdds) global.SashaCloud.setBudgetAdds(list);
    return month;
  }

  function addEvent(args) {
    if (!global.SashaCloud?.upsertCalendarEvent) return false;
    const allDay = Boolean(args.allDay) || !args.start;
    global.SashaCloud.upsertCalendarEvent({
      id: uid(),
      title: String(args.title || "").trim(),
      who: args.who === "sasha" || args.who === "masha" ? args.who : "",
      date: args.date,
      allDay,
      start: allDay ? "" : String(args.start || ""),
      end: allDay ? "" : String(args.end || ""),
      place: String(args.place || "").trim(),
      note: String(args.note || "").trim(),
      at: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    });
    try { global.sashaCalendarReload?.(); } catch {}
    return true;
  }

  function parseAmount(text) {
    const raw = norm(text)
      .replace(/через\s+\d+\s+(день|дня|дней)/g, " ")
      .replace(/\b\d{1,2}\s+[а-я]+/g, " ")
      .replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, " ")
      .replace(/\b(?:в|на|к)\s+\d{1,2}(?:[:.]\d{2})?\b/g, " ")
      .replace(/\b\d{1,2}[:.]\d{2}\b/g, " ");
    let m = raw.match(/(\d[\d\s]{0,12}\d|\d+)\s*(?:тыс|к\b)/);
    if (m) return Number(String(m[1]).replace(/\s/g, "")) * 1000;
    m = raw.match(/(\d[\d\s]{0,12}\d|\d+)\s*(?:руб|₽|рублей|рубля|рублях)\b/);
    if (m) return Number(String(m[1]).replace(/\s/g, ""));
    m = raw.match(/\b(\d[\d\s]{2,12}\d|\d{3,})\b/);
    if (m) return Number(String(m[1]).replace(/\s/g, ""));
    if (/(потрат|трат|запиш|списал|оплатил)/.test(raw)) {
      m = raw.match(/\b(\d+)\b/);
      if (m) return Number(m[1]);
    }
    return null;
  }

  function matchCategory(text) {
    const n = norm(text);
    let best = null;
    let bestLen = 0;
    for (const [name, aliases] of CATS) {
      for (const key of [norm(name), ...aliases]) {
        if (key && n.includes(key) && key.length >= bestLen) {
          best = name;
          bestLen = key.length;
        }
      }
    }
    return best;
  }

  function parsePerson(n) {
    if (hasAny(n, ["маше", "маши", "маша"]) || n.includes("для маши")) return "masha";
    if (hasAny(n, ["саше", "саши", "саша"]) || n.includes("для саши")) return "sasha";
    if (hasAny(n, ["мне", "себе"])) return sessionWho() || null;
    return null;
  }

  function parseEventWho(n) {
    if (hasAny(n, ["маше", "маши", "маша"])) return "masha";
    if (hasAny(n, ["саше", "саши", "саша"])) return "sasha";
    return "";
  }

  function parseTime(n) {
    let m = n.match(/(?:^|\s)(?:в|на|к)\s+(\d{1,2})(?:[:\.](\d{2}))?(?=\s|$)/);
    if (!m) m = n.match(/(?:^|\s)(\d{1,2})[:\.](\d{2})(?=\s|$)/);
    if (m) {
      const h = Number(m[1]);
      const min = Number(m[2] || 0);
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
        return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
      }
    }
    if (hasStem(n, "вечер")) return "19:00";
    if (hasStem(n, "утр")) return "09:00";
    if (hasAny(n, ["днем", "днём"])) return "14:00";
    return "";
  }

  function parseDate(n) {
    const today = moscowToday();
    if (hasWord(n, "сегодня")) return today;
    if (hasWord(n, "послезавтра")) return addDays(today, 2);
    if (hasWord(n, "завтра")) return addDays(today, 1);
    const thru = n.match(/через\s+(\d+)\s+(день|дня|дней)/);
    if (thru) return addDays(today, Number(thru[1]));
    for (const [word, wd] of WEEKDAYS) {
      if (n.includes(word)) {
        const cur = weekdayOf(today);
        const add = (wd - cur + 7) % 7;
        return addDays(today, add);
      }
    }
    let m = n.match(/\b(\d{1,2})\s+([а-я]+)/);
    if (m) {
      const day = Number(m[1]);
      const mon = MONTHS.find((row) => m[2].startsWith(row[0]));
      if (mon && day >= 1 && day <= 31) {
        const year = Number(today.slice(0, 4));
        let ymd = year + "-" + String(mon[1]).padStart(2, "0") + "-" + String(day).padStart(2, "0");
        if (ymd < today) ymd = (year + 1) + ymd.slice(4);
        return ymd;
      }
    }
    m = n.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        let ymd = year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
        if (!m[3] && ymd < today) ymd = (year + 1) + ymd.slice(4);
        return ymd;
      }
    }
    return "";
  }

  function stripFiller(text) {
    return String(text || "")
      .replace(/^(пожалуйста|давай|можешь|слушай|короче|ну)\s+/i, "")
      .replace(/^(добавь|запиши|напомни|поставь|открой|покажи|перейди|зайди)\s+(дело\s+)?/i, "")
      .trim();
  }

  function taskText(text) {
    return stripFiller(text)
      .replace(/^(дело\s+)?(маше|маши|саше|саши|для маши|для саши|мне|себе)\s*[:\-–]?\s*/i, "")
      .replace(/^(маше|саше|маша|саша)\s+/i, "")
      .replace(/(^|\s)(сегодня|завтра|послезавтра)(?=\s|$)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function eventTitle(text) {
    return stripFiller(text)
      .replace(/(^|\s)(сегодня|завтра|послезавтра|утром|днем|вечером|событие|встречу|встреча|встречи|напоминание)(?=\s|$)/gi, " ")
      .replace(/(^|\s)(в|во|на|к)\s+(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)(?=\s|$)/gi, " ")
      .replace(/(^|\s)(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)(?=\s|$)/gi, " ")
      .replace(/(^|\s)в календарь(?=\s|$)/gi, " ")
      .replace(/(^|\s)в календаре(?=\s|$)/gi, " ")
      .replace(/\d{1,2}\s+(январ[а-я]*|феврал[а-я]*|март[а-я]*|апрел[а-я]*|ма[йяе]|июн[а-я]*|июл[а-я]*|август[а-я]*|сент[а-я]*|октябр[а-я]*|ноябр[а-я]*|декабр[а-я]*)/gi, " ")
      .replace(/\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?/g, " ")
      .replace(/(?:^|\s)(?:в|на|к)\s+\d{1,2}(?:[:.]\d{2})?(?=\s|$)/gi, " ")
      .replace(/\d{1,2}[:.]\d{2}/g, " ")
      .replace(/(^|\s)(саше|саши|саша|маше|маши|маша|нам|общее)(?=\s|$)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isQuestion(n) {
    return /^(что|какие|какой|какая|когда|сколько|есть ли|подскажи|скажи|какие дела|а что)/.test(n)
      || /(что завтра|что сегодня|на неделе|какие дела|что по еде|что по питанию|какой рацион)/.test(n);
  }

  function listTasks(who) {
    const ctx = collectContext();
    const items = who === "sasha" ? ctx.tasks.sasha : ctx.tasks.masha;
    const label = who === "sasha" ? "Саши" : "Маши";
    if (!items.length) return "Открытых дел у " + label + " сейчас нет.";
    return "Дела " + label + ": " + items.join("; ") + ".";
  }

  function listEvents(from, to) {
    const ctx = collectContext();
    const items = ctx.events.filter((e) => e.date >= from && e.date <= to);
    if (!items.length) {
      if (from === to) return "На " + prettyDate(from) + " в календаре пока пусто.";
      return "На эти дни в календаре пока пусто.";
    }
    return items.map((e) => prettyDate(e.date) + (e.start ? " в " + e.start : "") + " — " + e.title).join("; ") + ".";
  }

  function answerQuestion(text) {
    const n = norm(text);
    const ctx = collectContext();
    const date = parseDate(n) || (/\bнедел/.test(n) ? "" : "");
    if (/(дел|задач|туду|todo)/.test(n)) {
      if (/(саш)/.test(n)) return { say: listTasks("sasha") };
      if (/(маш)/.test(n)) return { say: listTasks("masha") };
      const a = listTasks("sasha");
      const b = listTasks("masha");
      return { say: a + " " + b };
    }
    if (/(рацион|питани|меню|что на ужин|что на обед|что на завтрак|еда на)/.test(n)) {
      return {
        say: ctx.ration
          ? "Сейчас закреплён рацион: «" + ctx.ration + "». Открываю питание."
          : "Рацион недели не закреплён. Открываю питание — там можно выбрать.",
        open: LINKS.pitanie,
      };
    }
    if (date) return { say: listEvents(date, date), calendar: true };
    if (/\bнедел/.test(n) || /ближайш/.test(n) || /календар/.test(n) || /встреч/.test(n) || /что сегодня|что завтра/.test(n)) {
      const to = addDays(ctx.today, 7);
      return { say: listEvents(ctx.today, to), calendar: true };
    }
    return null;
  }

  function openSection(n) {
    const go = (key, say, extra) => ({ say, ...extra });
    if (/(домой|главн|экосистем|лендинг)/.test(n)) return go("home", "Возвращаю на главную.", { home: true });
    if (/(бюджет|мониторинг|деньг|финанс|fcf)/.test(n)) return go("budget", "Открываю мониторинг бюджета.", { open: LINKS.budget });
    if ((hasStem(n, "питани") || hasStem(n, "рацион") || hasWord(n, "меню") || hasStem(n, "рецепт") || hasAny(n, ["еду", "еда"])) && !hasStem(n, "запиш") && !hasStem(n, "потрат")) {
      return go("pitanie", "Открываю питание.", { open: LINKS.pitanie });
    }
    if ((hasStem(n, "заметк") || n.includes("список дел") || hasAny(n, ["туду", "todo"])) && !isTaskHint(n)) {
      return go("zametki", "Открываю заметки.", { open: LINKS.zametki });
    }
    if (/(календар|событи|встреч|готовк)/.test(n) && !/(поставь|добав|запиш)/.test(n) && !parseDate(n)) {
      return go("calendar", "Открываю календарь.", { calendar: true });
    }
    if (/(цел[иь]|горизонт|желани)/.test(n) && !/(добав)/.test(n)) {
      return go("goals", "Открываю цели.", { goals: true });
    }
    if (/(ремонт|чек.?лист|whitebox|отделк|мебел|материал|вдохновлен|референс)/.test(n) && !/(потрат|руб)/.test(n)) {
      return go("remont", "Открываю ремонт.", { open: LINKS.remont });
    }
    return null;
  }

  function finishTask(person, text, due) {
    const task = taskText(text);
    if (!task || task.length < 2) {
      pending = { type: "task", who: person, due: due || "" };
      return { say: person === "masha" ? "Какое дело добавить Маше?" : "Какое дело добавить Саше?" };
    }
    pending = null;
    addNote(person, task, due);
    const who = person === "masha" ? "Маше" : "Саше";
    const when = due ? " на " + prettyDate(due) : "";
    return { say: "Добавила дело " + who + when + ": «" + task + "». Оно уже в заметках.", open: LINKS.zametki };
  }

  function finishExpense(amount, category) {
    if (!amount) {
      pending = { type: "expense", category: category || "" };
      return { say: category ? "Категория «" + category + "» есть. Назовите сумму цифрами." : "Какую сумму записать?" };
    }
    if (!category) {
      pending = { type: "expense", amount };
      return { say: "Сумму " + amount.toLocaleString("ru-RU") + " ₽ услышала. В какую категорию — такси, рестораны, супермаркеты?" };
    }
    pending = null;
    const month = addExpense(category, amount);
    return {
      say: "Записала " + amount.toLocaleString("ru-RU") + " ₽ в «" + category + "» за " + monthName(month) + ".",
      open: LINKS.budget,
    };
  }

  function finishEvent(args) {
    const title = String(args.title || "").trim();
    if (!title || title.length < 2) {
      pending = { type: "event", date: args.date, start: args.start || "", who: args.who || "" };
      return { say: "Как назвать встречу на " + prettyDate(args.date) + "?" };
    }
    pending = null;
    if (!addEvent(args)) {
      return { say: "Календарь с этой страницы не пишется. Откройте главную и повторите.", calendar: true };
    }
    return {
      say: "Поставила «" + title + "» на " + prettyDate(args.date) + (args.start ? " в " + args.start : "") + ".",
      calendar: true,
    };
  }

  function continuePending(text) {
    const n = norm(text);
    if (!pending) return null;
    if (/(открой|покажи|перейди|найди|погугли|тем[ауы]|отмена|не надо|стоп)/.test(n)) {
      pending = null;
      return interpret(text);
    }
    if (pending.type === "task") return finishTask(pending.who, text, pending.due);
    if (pending.type === "expense") {
      const amount = parseAmount(text) || pending.amount;
      const category = matchCategory(text) || pending.category;
      if (CAT_NAMES.includes(n)) return finishExpense(amount, n);
      return finishExpense(amount, category);
    }
    if (pending.type === "event") {
      return finishEvent({
        title: eventTitle(text) || stripFiller(text),
        date: pending.date,
        start: parseTime(n) || pending.start,
        who: parseEventWho(n) || pending.who,
      });
    }
    pending = null;
    return null;
  }

  function interpret(text) {
    const raw = String(text || "").trim();
    const n = norm(raw);
    if (!n) return { say: "Скажите ещё раз — я не расслышала." };

    if (/(помощ|умеешь|сценари|что можешь|help|как тобой)/.test(n)) {
      return { say: "Можно своими словами. Открыть раздел. Добавить дело Саше или Маше. Записать трату. Поставить встречу на завтра. Спросить, что сегодня или какие дела. Если нужен интернет — скажите «найди …»." };
    }
    if (/(найди|погугли|поиск|что такое|кто такой|загугли)/.test(n)) {
      const q = raw.replace(/^(найди|погугли|поиск|что такое|кто такой|загугли)\s+/i, "").trim() || raw;
      return { say: "Сама в интернет не хожу. Открыла поиск Яндекса.", search: q };
    }
    if (/(светл(ая|ую) тем|темн(ая|ую) тем|переключ.*тем)/.test(n)) {
      return { say: "Переключаю тему.", theme: true };
    }

    if (isQuestion(n)) {
      const ans = answerQuestion(raw);
      if (ans) return ans;
    }

    const amount = parseAmount(raw);
    const cat = matchCategory(raw);
    const wantsMoney = hasStem(n, "добав") || hasStem(n, "запиш") || hasStem(n, "потрат") || hasStem(n, "трат") || hasStem(n, "затрат") || hasWord(n, "минус") || hasStem(n, "списал") || hasStem(n, "оплатил") || (amount && cat);
    if (amount && cat) return finishExpense(amount, cat);
    if (wantsMoney && (amount || cat) && !parsePerson(n)) return finishExpense(amount, cat);

    const person = parsePerson(n);
    const date = parseDate(n);
    const time = parseTime(n);
    const title = eventTitle(raw);
    const wantsCal = hasStem(n, "поставь") || hasStem(n, "встреч") || hasStem(n, "событи") || hasStem(n, "календар") || n.includes("запись к") || hasStem(n, "стоматолог") || hasWord(n, "врач") || hasWord(n, "кино") || n.includes("день рожден") || Boolean(time && date && title);
    const wantsTask = isTaskHint(n) || (person && !wantsCal);

    if (person && (wantsTask || hasAny(n, ["маше", "саше", "маша", "саша"])) && !wantsCal) {
      return finishTask(person, raw, date);
    }

    if (date && (wantsCal || (title && title.length >= 2 && !person && !amount))) {
      if (isQuestion(n)) {
        return { say: listEvents(date, date), calendar: true };
      }
      return finishEvent({ title, date, start: time, who: parseEventWho(n) });
    }

    if (person && title && title.length >= 2) return finishTask(person, raw, date);

    const opened = openSection(n);
    if (opened) return opened;

    const q = answerQuestion(raw);
    if (q) return q;

    return {
      say: "Не совсем поняла. Можно так: «Саше купить хлеб», «запиши 1500 в такси», «завтра в 19 ужин», «что завтра».",
    };
  }

  function ask(text) {
    const cont = continuePending(text);
    if (cont) return cont;
    return interpret(text);
  }

  function attach() {}

  global.SashaButler = {
    hasKey() { return true; },
    saveKey() { return true; },
    ask,
    attach,
    explainError(err) {
      return "Не получилось обработать фразу. Попробуйте ещё раз своими словами.";
    },
    greeting() {
      return "Привет. Говорите как удобно: открыть раздел, записать дело или трату, поставить встречу, спросить что завтра.";
    },
  };
})(window);
