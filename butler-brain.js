(function (global) {
  const KEY_STORE = "sasha-butler-gemini";
  const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
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
    "Ипотека платеж", "Дедушка долг", "Ремонт квартиры", "Квартира Тайланд",
    "Свадебное путешествие", "Саша учеба", "Парковка", "Отпуска", "Страховка",
    "Налоги", "Ребенок", "Супермаркеты", "Такси", "Рестораны", "Одежда и обувь",
    "Квартплата", "Мобильная связь", "Товары для дома", "Косметика", "Развлечения",
    "Бьюти процедуры", "Парковки и штрафы", "Бензин", "Переводы", "Прочее",
    "Расходы на семьи", "Подарки друг другу", "Крупные покупки", "Абонемент в спорт-зал",
  ];
  const history = [];

  const TOOLS = [{
    functionDeclarations: [
      {
        name: "open_section",
        description: "Открыть раздел семейного пространства.",
        parameters: {
          type: "OBJECT",
          properties: {
            section: {
              type: "STRING",
              enum: ["home", "budget", "pitanie", "zametki", "remont", "calendar", "goals"],
            },
          },
          required: ["section"],
        },
      },
      {
        name: "add_task",
        description: "Добавить дело Саше или Маше в заметки.",
        parameters: {
          type: "OBJECT",
          properties: {
            who: { type: "STRING", enum: ["sasha", "masha"] },
            text: { type: "STRING" },
          },
          required: ["who", "text"],
        },
      },
      {
        name: "add_expense",
        description: "Записать трату в факт бюджета за текущий месяц.",
        parameters: {
          type: "OBJECT",
          properties: {
            amount: { type: "NUMBER" },
            category: { type: "STRING", enum: CATS },
          },
          required: ["amount", "category"],
        },
      },
      {
        name: "add_event",
        description: "Поставить событие в семейный календарь.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            date: { type: "STRING", description: "YYYY-MM-DD" },
            start: { type: "STRING", description: "HH:MM, пусто если весь день" },
            end: { type: "STRING" },
            allDay: { type: "BOOLEAN" },
            who: { type: "STRING", enum: ["both", "sasha", "masha"] },
            place: { type: "STRING" },
            note: { type: "STRING" },
          },
          required: ["title", "date"],
        },
      },
      {
        name: "set_theme",
        description: "Переключить светлую или тёмную тему.",
        parameters: {
          type: "OBJECT",
          properties: { theme: { type: "STRING", enum: ["light", "dark"] } },
          required: ["theme"],
        },
      },
      {
        name: "web_search",
        description: "Открыть поиск Яндекса, если нужен интернет.",
        parameters: {
          type: "OBJECT",
          properties: { query: { type: "STRING" } },
          required: ["query"],
        },
      },
    ],
  }];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function moscowToday() {
    return new Date().toLocaleString("sv-SE", { timeZone: "Europe/Moscow" }).slice(0, 10);
  }
  function monthName(n) {
    return ["январе","феврале","марте","апреле","мае","июне","июле","августе","сентябре","октябре","ноябре","декабре"][n - 1];
  }
  function snap() {
    try { return global.SashaCloud?.snapshot?.() || {}; } catch { return {}; }
  }
  function hasKey() {
    try { return Boolean(localStorage.getItem(KEY_STORE)); } catch { return false; }
  }
  function getKey() {
    try {
      return String(localStorage.getItem(KEY_STORE) || "")
        .trim()
        .replace(/^['"]+|['"]+$/g, "")
        .replace(/\s+/g, "");
    } catch {
      return "";
    }
  }
  function saveKey(value) {
    const key = String(value || "")
      .trim()
      .replace(/^['"]+|['"]+$/g, "")
      .replace(/\s+/g, "");
    try {
      if (key) localStorage.setItem(KEY_STORE, key);
      else localStorage.removeItem(KEY_STORE);
    } catch {}
    return Boolean(key);
  }

  function collectContext() {
    const cloud = snap();
    const notes = cloud.notes || {};
    const open = (list) => (Array.isArray(list) ? list : [])
      .filter((t) => t && !t.deleted && !t.archived && !t.done)
      .slice(-8)
      .map((t) => t.text)
      .filter(Boolean);
    const today = moscowToday();
    const events = (cloud.calendar || [])
      .filter((e) => e && !e.deleted && String(e.date || "") >= today)
      .slice(0, 16)
      .map((e) => ({
        date: e.date,
        title: e.title,
        start: e.start || "",
        who: e.who || "both",
      }));
    const plan = cloud.cookingPlan || {};
    return {
      today,
      page: location.pathname + location.hash,
      who: global.SashaAuth?.session?.()?.id || "",
      ration: plan.title || "",
      tasks: { sasha: open(notes.sasha), masha: open(notes.masha) },
      events,
    };
  }

  function addNote(person, text) {
    const cloud = snap();
    const notes = {
      sasha: Array.isArray(cloud.notes?.sasha) ? cloud.notes.sasha.slice() : [],
      masha: Array.isArray(cloud.notes?.masha) ? cloud.notes.masha.slice() : [],
    };
    notes[person] = notes[person] || [];
    notes[person].push({ id: uid(), text, done: false, at: Date.now(), updatedAt: Date.now() });
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

  function runTool(name, args) {
    const a = args || {};
    if (name === "open_section") {
      const map = {
        home: { say: "Возвращаю на главную.", home: true },
        budget: { say: "Открываю мониторинг бюджета.", open: LINKS.budget },
        pitanie: { say: "Открываю питание.", open: LINKS.pitanie },
        zametki: { say: "Открываю заметки.", open: LINKS.zametki },
        remont: { say: "Открываю ремонт.", open: LINKS.remont },
        calendar: { say: "Открываю календарь.", calendar: true },
        goals: { say: "Открываю цели.", goals: true },
      };
      return { summary: map[a.section]?.say || "Неизвестный раздел.", extra: map[a.section] || {} };
    }
    if (name === "add_task") {
      const who = a.who === "sasha" ? "sasha" : "masha";
      const text = String(a.text || "").trim();
      if (text.length < 2) return { summary: "Слишком короткое дело.", extra: {} };
      addNote(who, text);
      const label = who === "sasha" ? "Саше" : "Маше";
      return {
        summary: `Добавила дело ${label}: «${text}».`,
        extra: { open: LINKS.zametki },
      };
    }
    if (name === "add_expense") {
      const amount = Number(a.amount);
      const category = CATS.includes(a.category) ? a.category : "Прочее";
      if (!amount || amount <= 0) return { summary: "Нужна сумма больше нуля.", extra: {} };
      const month = addExpense(category, amount);
      return {
        summary: `Записала ${amount.toLocaleString("ru-RU")} ₽ в «${category}» за ${monthName(month)}.`,
        extra: { open: LINKS.budget },
      };
    }
    if (name === "add_event") {
      const title = String(a.title || "").trim();
      if (!title || !a.date) return { summary: "Нужны название и дата.", extra: {} };
      if (!addEvent(a)) {
        return { summary: "Календарь сейчас недоступен. Откройте главную и повторите.", extra: { calendar: true } };
      }
      return {
        summary: `Поставила «${title}» на ${a.date}${a.start ? " в " + a.start : ""}.`,
        extra: { calendar: true },
      };
    }
    if (name === "set_theme") {
      const want = a.theme === "light" ? "light" : "dark";
      const now = document.documentElement.dataset.theme === "light" ? "light" : "dark";
      return { summary: want === now ? "Эта тема уже включена." : "Переключаю тему.", extra: { theme: want !== now } };
    }
    if (name === "web_search") {
      const q = String(a.query || "").trim();
      return { summary: q ? `Открыла поиск: ${q}` : "Нужен запрос.", extra: q ? { search: q } : {} };
    }
    return { summary: "Неизвестный инструмент.", extra: {} };
  }

  function systemPrompt(ctx) {
    return [
      "Ты Дворецкий семьи Саши и Маши. Говори по-русски, коротко, тепло, без канцелярита.",
      "Если нужно действие в их пространстве — вызови инструмент. Не выдумывай, что уже записала, пока инструмент не выполнен.",
      "Сегодня (Москва): " + ctx.today + ".",
      "Сейчас открыто: " + ctx.page + (ctx.who ? ". Вошла: " + ctx.who : "") + ".",
      ctx.ration ? "Закреплённый рацион: " + ctx.ration + "." : "Рацион недели не закреплён.",
      "Открытые дела Саши: " + (ctx.tasks.sasha.join("; ") || "нет") + ".",
      "Открытые дела Маши: " + (ctx.tasks.masha.join("; ") || "нет") + ".",
      "Ближайшие события: " + (ctx.events.map((e) => e.date + " " + (e.start || "") + " " + e.title).join("; ") || "нет") + ".",
      "Категории трат только из списка инструмента.",
    ].join("\n");
  }

  function explainError(err) {
    const raw = String(err?.message || err || "");
    const low = raw.toLowerCase();
    if (err?.name === "AbortError" || /abort|timeout/i.test(raw)) {
      return "Google AI слишком долго отвечает. Нажмите «Отправить» ещё раз.";
    }
    if (/failed to fetch|networkerror|load failed/i.test(raw)) {
      return "Не удалось связаться с Google AI. Проверьте интернет и что ключ не ограничен чужим сайтом.";
    }
    if (/api[_ ]key not valid|invalid.*key|api_key_invalid|403|401/i.test(low)) {
      return "Ключ Google AI не принят. Создайте новый на aistudio.google.com/apikey и вставьте ещё раз кнопкой «ключ».";
    }
    if (/not found|404|not supported/i.test(low)) {
      return "Эта модель Google AI сейчас недоступна для ключа. Создайте ключ в AI Studio ещё раз — без ограничения по сайту.";
    }
    return "Умный режим не ответил: " + raw.replace(/key=[^&\s]+/gi, "key=…").slice(0, 180);
  }

  async function gemini(contents, ctx, model, withThinkingOff) {
    const key = getKey();
    if (!key) throw new Error("no key");
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt(ctx) }] },
      contents,
      tools: TOOLS,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    };
    if (withThinkingOff) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || ("HTTP " + res.status);
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      const cand = data?.candidates?.[0];
      if (!cand) {
        const block = data?.promptFeedback?.blockReason;
        throw new Error(block ? "Ответ заблокирован фильтром: " + block : "Пустой ответ модели");
      }
      return cand.content || { parts: [] };
    } finally {
      clearTimeout(t);
    }
  }

  async function geminiWithFallback(contents, ctx) {
    let last = null;
    for (const model of MODELS) {
      for (const thinkingOff of [true, false]) {
        try {
          return await gemini(contents, ctx, model, thinkingOff);
        } catch (err) {
          last = err;
          const msg = String(err?.message || "");
          if (/api[_ ]key not valid|api_key_invalid|permission|403|401/i.test(msg)) throw err;
          if (err?.name === "AbortError" || /abort|failed to fetch/i.test(msg)) throw err;
        }
      }
    }
    throw last || new Error("no model");
  }

  function partText(content) {
    return (content?.parts || []).map((p) => p.text || "").join("").trim();
  }
  function partCalls(content) {
    return (content?.parts || []).filter((p) => p.functionCall?.name).map((p) => p.functionCall);
  }

  async function ask(text) {
    const ctx = collectContext();
    const contents = history.slice(-6);
    contents.push({ role: "user", parts: [{ text: String(text || "").trim() }] });
    let extra = {};
    let content = await geminiWithFallback(contents, ctx);
    for (let i = 0; i < 3; i += 1) {
      const calls = partCalls(content);
      if (!calls.length) break;
      contents.push({ role: "model", parts: content.parts });
      const responses = [];
      for (const call of calls) {
        let args = call.args || call.arguments || {};
        if (typeof args === "string") {
          try { args = JSON.parse(args); } catch { args = {}; }
        }
        const result = runTool(call.name, args);
        extra = { ...extra, ...(result.extra || {}) };
        responses.push({
          functionResponse: {
            name: call.name,
            response: { result: result.summary },
          },
        });
      }
      contents.push({ role: "user", parts: responses });
      content = await geminiWithFallback(contents, ctx);
    }
    const say = partText(content) || extra.say || "Готово.";
    history.push({ role: "user", parts: [{ text: String(text || "").trim() }] });
    history.push({ role: "model", parts: [{ text: say }] });
    if (history.length > 12) history.splice(0, history.length - 12);
    return { say, ...extra };
  }

  function injectCss() {
    if (document.getElementById("butler-brain-css")) return;
    const s = document.createElement("style");
    s.id = "butler-brain-css";
    s.textContent = `
.assist-key{border:1px solid var(--line,rgba(239,232,220,.08));background:var(--bg-2,#12141b);color:inherit;border-radius:999px;padding:8px 12px;font:600 11px Montserrat,sans-serif;cursor:pointer}
.assist-key.on{border-color:rgba(212,180,131,.55);color:var(--gold,#d4b483)}
.assist-key-row{display:none;gap:8px;padding:0 16px 10px;align-items:center}
.assist-key-row.show{display:flex}
.assist-key-row input{flex:1;min-width:0;border:1px solid var(--line,rgba(239,232,220,.08));background:var(--bg,#0b0c10);color:inherit;border-radius:999px;padding:10px 12px;font:500 14px Montserrat,sans-serif}
.assist-key-row button{border:0;background:var(--gold,#d4b483);color:var(--on-accent,#1a140c);border-radius:999px;padding:10px 12px;font:700 11px Montserrat,sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.assist-key-hint{margin:0;font-size:11px;color:var(--muted,#9a9286);line-height:1.35}
`;
    document.head.appendChild(s);
  }

  function attach() {
    injectCss();
    const head = document.querySelector(".assist-head");
    const panel = document.getElementById("assist-panel");
    if (!head || !panel || document.getElementById("assist-key")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "assist-key" + (hasKey() ? " on" : "");
    btn.id = "assist-key";
    btn.textContent = hasKey() ? "ключ ✓" : "ключ";
    const close = head.querySelector(".assist-close");
    if (close) head.insertBefore(btn, close);
    else head.appendChild(btn);
    const row = document.createElement("div");
    row.className = "assist-key-row";
    row.id = "assist-key-row";
    row.innerHTML = `
      <input id="assist-key-input" type="password" maxlength="200" placeholder="Ключ Google AI Studio" autocomplete="off" />
      <button type="button" id="assist-key-save">Сохранить</button>`;
    const log = document.getElementById("assist-log");
    panel.insertBefore(row, log || head.nextSibling);
    const hint = document.createElement("p");
    hint.className = "assist-key-hint";
    hint.id = "assist-key-hint";
    hint.hidden = true;
    hint.textContent = "Бесплатный ключ: aistudio.google.com → Get API key. Он останется только в этом браузере, в код сайта не попадёт.";
    row.after(hint);
    btn.addEventListener("click", () => {
      const on = !row.classList.contains("show");
      row.classList.toggle("show", on);
      hint.hidden = !on;
      if (on) document.getElementById("assist-key-input")?.focus();
    });
    document.getElementById("assist-key-save")?.addEventListener("click", () => {
      const input = document.getElementById("assist-key-input");
      const ok = saveKey(input?.value || "");
      if (input) input.value = "";
      btn.textContent = ok ? "ключ ✓" : "ключ";
      btn.classList.toggle("on", ok);
      row.classList.remove("show");
      hint.hidden = true;
      const logEl = document.getElementById("assist-log");
      if (logEl) {
        const el = document.createElement("div");
        el.className = "assist-msg bot";
        el.textContent = ok
          ? "Умный режим включён. Можно спрашивать своими словами."
          : "Ключ снят. Снова работаю короткими командами.";
        logEl.appendChild(el);
        logEl.scrollTop = logEl.scrollHeight;
      }
    });
  }

  global.SashaButler = { hasKey, saveKey, ask, attach, explainError, greeting() {
    return hasKey()
      ? "Привет. Спросите как угодно — открыть раздел, записать дело, трату или встречу, спросить, что завтра."
      : "Привет. Могу открыть разделы и записать дело или трату. Чтобы понимать свободные фразы, нажмите «ключ» и вставьте ключ Google AI.";
  } };
})(window);
