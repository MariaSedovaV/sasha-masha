(function () {
  const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
  const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const MONTHS_WHEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const COOK_BLOCKS = {
    ПН: { cookDay: "ВС", cookTime: "18:00", cover: "ПН–ВТ" },
    ВТ: { cookDay: "ВС", cookTime: "18:00", cover: "ПН–ВТ" },
    СР: { cookDay: "ВТ", cookTime: "18:00", cover: "СР–ЧТ" },
    ЧТ: { cookDay: "ВТ", cookTime: "18:00", cover: "СР–ЧТ" },
    ПТ: { cookDay: "ЧТ", cookTime: "18:00", cover: "ПТ–СБ" },
    СБ: { cookDay: "ЧТ", cookTime: "18:00", cover: "ПТ–СБ" },
    ВС: { cookDay: "ВС", cookTime: "11:00", cover: "ВС" },
  };
  const EAT_TIMES = {
    Завтрак: "08:00",
    Обед: "13:00",
    Ужин: "19:00",
    "Перекус 1": "10:30",
    "Перекус 2": "16:00",
    "Перекус 3": "21:00",
  };
  const BREAKFAST_BY_DAY = {
    ПН: { cook: "06:15", eat: "06:30" },
    ВТ: { cook: "06:15", eat: "06:30" },
    СР: { cook: "06:15", eat: "06:30" },
    ЧТ: { cook: "06:15", eat: "06:30" },
    ПТ: { cook: "06:15", eat: "06:30" },
    СБ: { cook: "09:30", eat: "10:00" },
    ВС: { cook: "09:30", eat: "10:00" },
  };
  const WHO_KEY = "sasha-masha-calendar-who";
  const PITANIE = "https://mariasedovav.github.io/sasha-masha-pitanie/";
  const NOTES = "https://mariasedovav.github.io/sasha-masha-zametki/";
  const WEEKLY_EVENTS = [
    {
      id: "training",
      title: "Тренировка",
      start: "07:00",
      weekdays: ["ПН", "ВТ", "СР", "ЧТ", "ПТ"],
      who: "",
      note: "Каждое утро с понедельника по пятницу.",
    },
    {
      id: "sasha-box-sat",
      title: "Саша бокс",
      start: "11:00",
      weekdays: ["СБ"],
      who: "sasha",
      note: "Каждую субботу.",
    },
    {
      id: "sasha-box-sun",
      title: "Саша бокс",
      start: "11:00",
      weekdays: ["ВС"],
      who: "sasha",
      note: "Каждое воскресенье.",
    },
  ];

  const state = {
    cursor: startOfMonth(new Date()),
    selected: isoDate(new Date()),
    editingId: null,
    editingRepeatId: null,
    deleteArmed: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isoDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function parseIso(value) {
    const [y, m, d] = String(value || "").split("-").map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function weekdayCode(d) {
    const js = d.getDay();
    return WEEKDAYS[js === 0 ? 6 : js - 1];
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cloud() {
    return window.SashaCloud ? window.SashaCloud.snapshot() : {};
  }

  function lastWho() {
    try {
      const v = localStorage.getItem(WHO_KEY);
      if (v === "sasha" || v === "masha") return v;
      const session = window.SashaAuth?.session?.();
      if (session?.id === "sasha" || session?.id === "masha") return session.id;
    } catch {}
    return "masha";
  }

  function saveWho(who) {
    if (who !== "sasha" && who !== "masha") return;
    try { localStorage.setItem(WHO_KEY, who); } catch {}
  }

  function whoLabel(who) {
    if (who === "sasha") return "Саша";
    if (who === "masha") return "Маша";
    return "общее";
  }

  function whoClass(who) {
    if (who === "sasha") return "sasha";
    if (who === "masha") return "masha";
    return "shared";
  }

  function formatDayTitle(iso) {
    const d = parseIso(iso);
    return d.getDate() + " " + MONTHS_WHEN[d.getMonth()];
  }

  function formatMonthTitle(d) {
    return MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function nextHour() {
    const n = new Date();
    n.setMinutes(0, 0, 0);
    n.setHours(n.getHours() + 1);
    return pad(n.getHours()) + ":00";
  }

  function planMatchesPinned(plan, pinned) {
    return Boolean(plan) && Boolean(pinned) && String(plan.rationId) === String(pinned);
  }

  function scheduleLookup(rationId, dayId, mealId) {
    const key = "r" + rationId + "|" + dayId + "|" + mealId;
    const custom = cloud().schedules?.[key];
    if (custom && !custom.deleted) return custom;
    return null;
  }

  function breakfastSlot(dayId) {
    return BREAKFAST_BY_DAY[dayId] || BREAKFAST_BY_DAY.ПН;
  }

  function isLegacyBreakfastCustom(custom) {
    if (!custom) return true;
    const cook = String(custom.cook?.time || "");
    const eat = String(custom.eat?.time || "");
    const legacyPairs = new Set([
      "07:30|08:00", "07:30|07:30", "07:00|07:00", "08:00|08:00",
      "06:15|06:40", "09:30|10:30",
      "|08:00", "07:30|",
    ]);
    return legacyPairs.has(cook + "|" + eat) || (!cook && !eat);
  }

  function isLegacyBreakfastCookTime(time) {
    return ["07:30", "07:00", "08:00"].includes(String(time || ""));
  }

  function isLegacyBreakfastEatTime(time) {
    return ["08:00", "07:30", "07:00", "06:40", "10:30"].includes(String(time || ""));
  }

  function normalizeCookItem(item) {
    const next = { ...item, who: "masha" };
    if (item.mealType === "Завтрак") {
      const slot = breakfastSlot(item.weekday);
      if (isLegacyBreakfastCookTime(item.time)) next.time = slot.cook;
    }
    return next;
  }

  function normalizeMealItem(item) {
    const next = { ...item, who: "" };
    if (item.mealType === "Завтрак") {
      const slot = breakfastSlot(item.weekday);
      if (isLegacyBreakfastEatTime(item.time)) next.time = slot.eat;
    }
    return next;
  }

  function buildPlanFromIndex(pinned, plan) {
    const ration = (window.COOKING_INDEX || []).find((r) => String(r.id) === String(pinned));
    if (!ration) {
      return {
        rationId: pinned || null,
        title: plan?.title || "",
        items: (plan?.items || []).map(normalizeCookItem),
        meals: (plan?.meals || []).map(normalizeMealItem),
      };
    }
    const items = [];
    const meals = [];
    const seenCook = new Set();
    (ration.days || []).forEach((day) => {
      (day.meals || []).forEach((meal) => {
        const custom = scheduleLookup(ration.id, day.id, meal.id);
        const isMain = meal.id === "Обед" || meal.id === "Ужин";
        const isBreakfast = meal.id === "Завтрак";
        if (isBreakfast) {
          const slot = breakfastSlot(day.id);
          const useCustom = custom && !isLegacyBreakfastCustom(custom);
          const cookTime = useCustom && custom.cook?.time ? custom.cook.time : slot.cook;
          const cookDay = useCustom && custom.cook?.dayId ? custom.cook.dayId : day.id;
          const eatTime = useCustom && custom.eat?.time ? custom.eat.time : slot.eat;
          const eatDay = useCustom && custom.eat?.dayId ? custom.eat.dayId : day.id;
          const key = cookDay + "|" + cookTime + "|" + meal.id + "|" + meal.title + "|";
          if (!seenCook.has(key)) {
            seenCook.add(key);
            items.push(normalizeCookItem({
              weekday: cookDay,
              time: cookTime,
              mealType: meal.id,
              title: meal.title,
              cover: "",
              kind: "same-day",
              eatDay: day.id,
            }));
          }
          meals.push(normalizeMealItem({
            weekday: eatDay,
            time: eatTime,
            mealType: meal.id,
            title: meal.title,
          }));
          return;
        }
        if (isMain) {
          let cookDay = day.id;
          let time = "07:30";
          let cover = "";
          let kind = "same-day";
          const block = COOK_BLOCKS[day.id] || COOK_BLOCKS.ВС;
          cookDay = block.cookDay;
          time = block.cookTime;
          cover = block.cover;
          kind = "batch";
          if (custom?.cook) {
            if (custom.cook.time) time = custom.cook.time;
            if (custom.cook.dayId) cookDay = custom.cook.dayId;
            if (custom.cook.cover) cover = custom.cook.cover;
            if (custom.cook.kind) kind = custom.cook.kind;
          }
          if (kind !== "none" && time) {
            const key = cookDay + "|" + time + "|" + meal.id + "|" + meal.title + "|" + cover;
            if (!seenCook.has(key)) {
              seenCook.add(key);
              items.push(normalizeCookItem({
                weekday: cookDay,
                time,
                mealType: meal.id,
                title: meal.title,
                cover,
                kind,
                eatDay: day.id,
              }));
            }
          }
        }
        const eatTime = custom?.eat?.time || EAT_TIMES[meal.id] || "12:00";
        const eatDay = custom?.eat?.dayId || day.id;
        if (eatTime) {
          meals.push(normalizeMealItem({
            weekday: eatDay,
            time: eatTime,
            mealType: meal.id,
            title: meal.title,
          }));
        }
      });
    });
    return { rationId: ration.id, title: ration.title, items, meals };
  }

  function nutritionPlan() {
    const snap = cloud();
    const pinned = snap.pinned?.id;
    // Без закреплённого рациона питание в календаре не показываем.
    if (!pinned) {
      return { rationId: null, title: "", items: [], meals: [] };
    }
    const plan = snap.cookingPlan;
    // Всегда собираем из индекса + актуальных schedules — календарь не отстаёт от питания.
    if (Array.isArray(window.COOKING_INDEX) && window.COOKING_INDEX.length) {
      const built = buildPlanFromIndex(pinned, plan);
      return {
        rationId: built.rationId,
        title: built.title || plan?.title || "",
        items: built.items,
        meals: built.meals,
      };
    }
    const fromCloud = planMatchesPinned(plan, pinned);
    const cloudCook = fromCloud && Array.isArray(plan.items) && plan.items.length
      ? plan.items.map(normalizeCookItem)
      : [];
    const cloudMeals = fromCloud && Array.isArray(plan.meals) && plan.meals.length
      ? plan.meals.map(normalizeMealItem)
      : [];
    if (!cloudCook.length && !cloudMeals.length) {
      return { rationId: pinned, title: plan?.title || "", items: [], meals: [] };
    }
    return {
      rationId: plan?.rationId || pinned,
      title: plan?.title || "",
      items: cloudCook,
      meals: cloudMeals,
    };
  }

  function userEvents() {
    return (cloud().calendar || []).filter((e) => e && !e.deleted);
  }

  function notePreview(task) {
    const blocks = Array.isArray(task?.details) ? task.details : [];
    const first = blocks.find((b) => String(b.text || "").trim());
    return first ? String(first.text).trim() : "";
  }

  function noteEventsOn(iso) {
    const notes = cloud().notes || {};
    const out = [];
    ["sasha", "masha"].forEach((who) => {
      (notes[who] || []).forEach((task) => {
        if (!task || task.deleted || task.archived || String(task.due || "") !== iso) return;
        if (task.done && Number(task.doneAt || 0) && Date.now() - Number(task.doneAt) >= 30 * 24 * 60 * 60 * 1000) return;
        out.push({
          id: "note|" + who + "|" + task.id,
          kind: "note",
          date: iso,
          start: "",
          end: "",
          allDay: false,
          reminder: true,
          title: task.text || "Дело",
          who,
          done: !!task.done,
          details: Array.isArray(task.details) ? task.details : [],
          preview: notePreview(task),
          noteId: task.id,
        });
      });
    });
    return out;
  }

  function noteDetailsHtml(blocks) {
    const list = Array.isArray(blocks) ? blocks : [];
    if (!list.length) return "";
    return `<div class="cal-note-body">${list.map((b) => {
      if (b.type === "gap") {
        const n = Math.max(1, Math.min(12, Number(b.count) || 1));
        return `<div class="cal-note-gap" style="height:${n * 0.7}em"></div>`;
      }
      if (b.type === "li") {
        return `<p class="cal-note-li${b.done ? " done" : ""}"><i></i><span>${escapeHtml(b.text)}</span></p>`;
      }
      return `<p class="cal-note-p">${escapeHtml(b.text || "").replace(/\n/g, "<br>")}</p>`;
    }).join("")}</div>`;
  }

  function cookEventsOn(iso) {
    const { items } = nutritionPlan();
    const code = weekdayCode(parseIso(iso));
    return items
      .filter((item) => item.weekday === code && item.time)
      .map((item) => ({
        id: "cook|" + iso + "|" + item.weekday + "|" + item.time + "|" + item.mealType + "|" + item.title,
        kind: "cook",
        date: iso,
        start: item.time,
        end: "",
        allDay: false,
        title: item.title,
        mealType: item.mealType,
        cover: item.cover || "",
        cookKind: item.kind,
        who: "masha",
      }));
  }

  function mealEventsOn(iso) {
    const { meals } = nutritionPlan();
    const code = weekdayCode(parseIso(iso));
    return meals
      .filter((item) => item.weekday === code && item.time)
      .map((item) => ({
        id: "eat|" + iso + "|" + item.weekday + "|" + item.time + "|" + item.mealType + "|" + item.title,
        kind: "eat",
        date: iso,
        start: item.time,
        end: "",
        allDay: false,
        title: item.title,
        mealType: item.mealType,
        who: "",
      }));
  }

  function timeKey(item) {
    if (item.allDay) return "00:00";
    return item.start || "99:99";
  }

  function userEventsOn(iso) {
    return userEvents()
      .filter((e) => e.date === iso)
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return String(a.start || "").localeCompare(String(b.start || ""));
      });
  }

  function weeklyRules() {
    const cloudMap = cloud().calendarRepeat || {};
    const ids = new Set([...WEEKLY_EVENTS.map((r) => r.id), ...Object.keys(cloudMap)]);
    const out = [];
    ids.forEach((id) => {
      const def = WEEKLY_EVENTS.find((r) => r.id === id) || {
        id,
        title: "",
        start: "09:00",
        end: "",
        allDay: false,
        weekdays: [],
        who: "",
        note: "",
        place: "",
      };
      const custom = cloudMap[id];
      if (custom?.deleted) return;
      const weekdays = Array.isArray(custom?.weekdays) && custom.weekdays.length
        ? custom.weekdays
        : def.weekdays;
      out.push({
        ...def,
        ...(custom || {}),
        id,
        weekdays,
        exceptions: Array.isArray(custom?.exceptions) ? custom.exceptions : [],
      });
    });
    return out;
  }

  function weeklyEventsOn(iso) {
    const code = weekdayCode(parseIso(iso));
    const overrides = new Set(
      userEvents()
        .filter((e) => e.repeatId && e.date === iso)
        .map((e) => String(e.repeatId))
    );
    return weeklyRules()
      .filter((item) => {
        if (!(item.weekdays || []).includes(code)) return false;
        if (!item.allDay && !item.start) return false;
        if ((item.exceptions || []).includes(iso)) return false;
        if (overrides.has(String(item.id))) return false;
        return true;
      })
      .map((item) => ({
        id: "week|" + item.id + "|" + iso,
        ruleId: item.id,
        kind: "week",
        date: iso,
        start: item.start || "",
        end: item.end || "",
        allDay: Boolean(item.allDay),
        title: item.title,
        who: item.who || "",
        note: item.note || "",
        place: item.place || "",
        weekdays: item.weekdays,
      }));
  }

  function marksFor(iso) {
    const weekly = weeklyEventsOn(iso);
    const users = userEventsOn(iso);
    const notes = noteEventsOn(iso);
    return {
      reminder: notes.length > 0,
      shared: mealEventsOn(iso).length > 0 || weekly.some((e) => !e.who),
      masha: users.some((e) => e.who === "masha") || cookEventsOn(iso).length > 0,
      sasha: users.some((e) => e.who === "sasha") || weekly.some((e) => e.who === "sasha"),
    };
  }

  function monthCells(cursor) {
    const first = startOfMonth(cursor);
    const js = first.getDay();
    const offset = js === 0 ? 6 : js - 1;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }

  function syncLabel() {
    const status = window.SashaCloud?.status?.() || {};
    if (status.ok) return "события общие на всех устройствах";
    if (status.error) return "пока локально — облако догонит, когда будет сеть";
    return "синхронизируем с облаком…";
  }

  function renderLead() {
    const lead = $("cal-lead");
    if (!lead) return;
    const plan = nutritionPlan();
    const bits = [];
    if (plan.title) bits.push("приготовление и приёмы по рациону «" + plan.title + "»");
    else bits.push("закрепите рацион в Питании — график еды появится сам");
    bits.push(syncLabel());
    lead.textContent = bits.join(". ") + ".";
  }

  function renderGrid() {
    const grid = $("cal-grid");
    const month = $("cal-month");
    if (!grid || !month) return;
    month.textContent = formatMonthTitle(state.cursor);
    const today = isoDate(new Date());
    const heads = WEEKDAY_SHORT.map((d) => `<span class="cal-dow">${d}</span>`).join("");
    const cells = monthCells(state.cursor).map((d) => {
      const iso = isoDate(d);
      const inMonth = d.getMonth() === state.cursor.getMonth();
      const marks = marksFor(iso);
      const cls = [
        "cal-cell",
        inMonth ? "" : "is-out",
        iso === today ? "is-today" : "",
        iso === state.selected ? "is-selected" : "",
      ].filter(Boolean).join(" ");
      const dots = [
        marks.shared ? '<i class="dot shared" title="Общие мероприятия"></i>' : "",
        marks.masha ? '<i class="dot masha" title="Маша"></i>' : "",
        marks.sasha ? '<i class="dot sasha" title="Саша"></i>' : "",
      ].join("");
      const bell = marks.reminder
        ? `<i class="cal-bell" title="Напоминание">${bellSvg()}</i>`
        : "";
      return `<button type="button" class="${cls}" data-date="${iso}" aria-pressed="${iso === state.selected}">
        <span class="cal-num-row">
          <span class="cal-num">${d.getDate()}</span>
          ${bell}
        </span>
        <span class="cal-dots">${dots}</span>
      </button>`;
    }).join("");
    grid.innerHTML = `<div class="cal-weekdays">${heads}</div><div class="cal-cells">${cells}</div>`;
    grid.querySelectorAll("[data-date]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selected = btn.dataset.date;
        render();
      });
    });
  }

  function bellSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.2a6.2 6.2 0 0 0-6.2 6.2v3.15l-1.55 2.4A1.15 1.15 0 0 0 5.2 16.8h13.6a1.15 1.15 0 0 0 .95-1.85l-1.55-2.4V9.4A6.2 6.2 0 0 0 12 3.2Zm0 17.1a2.35 2.35 0 0 0 2.3-1.85h-4.6A2.35 2.35 0 0 0 12 20.3Z"/></svg>';
  }

  function eventTimeLabel(item) {
    if (item.allDay) return "весь день";
    if (item.start && item.end) return item.start + "–" + item.end;
    return item.start || "";
  }

  function renderAgenda() {
    const box = $("cal-agenda");
    if (!box) return;
    const cook = cookEventsOn(state.selected);
    const meals = mealEventsOn(state.selected);
    const weekly = weeklyEventsOn(state.selected);
    const users = userEventsOn(state.selected);
    const notes = noteEventsOn(state.selected);
    const timed = [...cook, ...meals, ...weekly, ...users].sort((a, b) => timeKey(a).localeCompare(timeKey(b)));
    const rows = [...notes, ...timed];
    const listHtml = rows.length
      ? rows.map((item) => {
        if (item.kind === "cook") {
          return `<button type="button" class="cal-item masha" data-cook="${escapeHtml(item.id)}">
            <span class="cal-item-time">${escapeHtml(item.start)}</span>
            <span class="cal-item-body">
              <em>Маша</em>
              <strong>${escapeHtml(item.title)}</strong>
            </span>
          </button>`;
        }
        if (item.kind === "eat") {
          return `<button type="button" class="cal-item shared" data-eat="${escapeHtml(item.id)}">
            <span class="cal-item-time">${escapeHtml(item.start)}</span>
            <span class="cal-item-body">
              <em>общее · ${escapeHtml(item.mealType)}</em>
              <strong>${escapeHtml(item.title)}</strong>
            </span>
          </button>`;
        }
        if (item.kind === "week") {
          const cls = whoClass(item.who);
          return `<button type="button" class="cal-item ${cls}" data-week="${escapeHtml(item.id)}">
            <span class="cal-item-time">${escapeHtml(eventTimeLabel(item))}</span>
            <span class="cal-item-body">
              <em>${escapeHtml(whoLabel(item.who))}</em>
              <strong>${escapeHtml(item.title)}</strong>
            </span>
          </button>`;
        }
        if (item.kind === "note") {
          const cls = item.who === "sasha" ? "sasha" : "masha";
          return `<button type="button" class="cal-item ${cls} note${item.done ? " is-done" : ""}" data-note="${escapeHtml(item.id)}">
            <span class="cal-item-time" title="Напоминание"><i class="cal-item-bell">${bellSvg()}</i></span>
            <span class="cal-item-body">
              <em>${escapeHtml(whoLabel(item.who))}</em>
              <strong>${escapeHtml(item.title)}</strong>
              ${item.preview ? `<small>${escapeHtml(item.preview)}</small>` : ""}
            </span>
          </button>`;
        }
        return `<button type="button" class="cal-item ${whoClass(item.who)}" data-id="${escapeHtml(item.id)}">
          <span class="cal-item-time">${escapeHtml(eventTimeLabel(item))}</span>
          <span class="cal-item-body">
            <em>${escapeHtml(whoLabel(item.who))}</em>
            <strong>${escapeHtml(item.title)}</strong>
            ${item.place ? `<small>${escapeHtml(item.place)}</small>` : ""}
          </span>
        </button>`;
      }).join("")
      : "";
    const empty = !rows.length
      ? `<p class="cal-empty">В этот день пока тихо. Можно добавить событие — оно появится у обоих.</p>`
      : "";
    box.innerHTML = `
      <div class="cal-agenda-head">
        <div>
          <p class="eyebrow">${formatDayTitle(state.selected)}</p>
          <h3>Расписание дня</h3>
        </div>
        <button type="button" class="cal-add" id="cal-add">+ событие</button>
      </div>
      <div class="cal-legend">
        <span><i class="dot shared"></i> общие мероприятия</span>
        <span><i class="dot masha"></i> Маша</span>
        <span><i class="dot sasha"></i> Саша</span>
      </div>
      <div class="cal-list">${listHtml}${empty}</div>
    `;
    $("cal-add")?.addEventListener("click", () => openForm(null));
    box.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = userEvents().find((e) => String(e.id) === String(btn.dataset.id));
        if (item) openForm(item);
      });
    });
    box.querySelectorAll("[data-cook]").forEach((btn) => {
      btn.addEventListener("click", () => openNutritionSlot("cook", btn.dataset.cook));
    });
    box.querySelectorAll("[data-eat]").forEach((btn) => {
      btn.addEventListener("click", () => openNutritionSlot("eat", btn.dataset.eat));
    });
    box.querySelectorAll("[data-week]").forEach((btn) => {
      btn.addEventListener("click", () => openWeeklySlot(btn.dataset.week));
    });
    box.querySelectorAll("[data-note]").forEach((btn) => {
      btn.addEventListener("click", () => openNoteSlot(btn.dataset.note));
    });
  }

  function render() {
    if (!$("calendar-view") || $("calendar-view").hidden) return;
    renderLead();
    renderGrid();
    renderAgenda();
  }

  function toggleTimes() {
    const allDay = $("cal-allday")?.checked;
    $("cal-times")?.classList.toggle("hidden", !!allDay);
  }

  function selectedDows() {
    return [...document.querySelectorAll("#cal-dows button.is-on")].map((btn) => btn.dataset.dow);
  }

  function paintDows(selected) {
    const box = $("cal-dows");
    if (!box) return;
    const set = new Set(selected || []);
    box.innerHTML = WEEKDAYS.map((d) => {
      const on = set.has(d);
      return `<button type="button" data-dow="${d}" class="${on ? "is-on" : ""}" aria-pressed="${on}">${d}</button>`;
    }).join("");
    box.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("is-on");
        btn.setAttribute("aria-pressed", btn.classList.contains("is-on"));
      });
    });
  }

  function toggleRepeat() {
    const on = Boolean($("cal-repeat")?.checked);
    $("cal-repeat-fields")?.classList.toggle("hidden", !on);
    if (on && !selectedDows().length) {
      const code = weekdayCode(parseIso($("cal-date")?.value || state.selected));
      paintDows([code]);
    }
  }

  function fillForm(item) {
    const isSeries = Boolean(item?.kind === "week" || item?.repeating);
    const isEdit = Boolean(item);
    state.editingId = isSeries ? null : (item?.id || null);
    state.editingRepeatId = isSeries ? (item?.repeatId || item?.ruleId || null) : null;
    state.deleteArmed = false;
    $("cal-sheet-kicker").textContent = isEdit
      ? (isSeries ? "правка серии" : "правка события")
      : "новое событие";
    $("cal-sheet-title").textContent = isEdit ? "Что меняем" : "Что заносим";
    $("cal-title").value = item?.title || "";
    $("cal-date").value = item?.date || state.selected;
    $("cal-start").value = item?.start || nextHour();
    $("cal-end").value = item?.end || "";
    $("cal-allday").checked = Boolean(item?.allDay);
    $("cal-place").value = item?.place || "";
    $("cal-note").value = item?.note || "";
    $("cal-repeat").checked = isSeries;
    $("cal-only-day").checked = false;
    $("cal-only-wrap").hidden = !state.editingRepeatId;
    const who = item
      ? (item.who === "sasha" || item.who === "masha" ? item.who : "both")
      : lastWho();
    document.querySelectorAll('input[name="cal-who"]').forEach((el) => {
      el.checked = el.value === who;
    });
    paintDows(item?.weekdays || (isSeries ? [weekdayCode(parseIso(item?.date || state.selected))] : []));
    $("cal-error").textContent = "";
    $("cal-delete").hidden = !isEdit;
    $("cal-delete").textContent = "Удалить";
    toggleTimes();
    toggleRepeat();
  }

  function sheetCard() {
    return document.querySelector("#cal-sheet .cal-sheet-card");
  }

  function clearSheetPos() {
    const card = sheetCard();
    if (!card) return;
    card.classList.remove("is-anchored");
    card.style.position = "";
    card.style.top = "";
    card.style.left = "";
    card.style.width = "";
    card.style.maxHeight = "";
  }

  function placeSheetCard() {
    const sheet = $("cal-sheet");
    const card = sheetCard();
    const agenda = $("cal-agenda");
    if (!sheet || !card || sheet.hidden) return;
    clearSheetPos();
    const stacked = window.matchMedia("(max-width: 860px)").matches;
    if (stacked || !agenda) return;
    const r = agenda.getBoundingClientRect();
    if (r.width < 220 || r.height < 160) return;
    const pad = 16;
    const width = Math.min(420, Math.max(280, r.width - 20));
    const maxH = Math.min(r.height - 12, window.innerHeight - pad * 2);
    card.classList.add("is-anchored");
    card.style.position = "fixed";
    card.style.width = width + "px";
    card.style.maxHeight = Math.max(200, maxH) + "px";
    const h = Math.min(card.getBoundingClientRect().height, maxH);
    let left = r.left + (r.width - width) / 2;
    let top = r.top + Math.max(0, (r.height - h) / 2);
    left = Math.min(Math.max(pad, left), window.innerWidth - width - pad);
    top = Math.min(Math.max(pad, top), window.innerHeight - h - pad);
    card.style.left = left + "px";
    card.style.top = top + "px";
  }

  function openSheet() {
    const sheet = $("cal-sheet");
    if (!sheet) return;
    sheet.classList.remove("hidden");
    sheet.hidden = false;
    document.documentElement.classList.add("cal-sheet-open");
    requestAnimationFrame(() => {
      placeSheetCard();
      requestAnimationFrame(placeSheetCard);
    });
    if (!$("cal-form")?.hidden) setTimeout(() => $("cal-title")?.focus(), 40);
  }

  function closeSheet() {
    const sheet = $("cal-sheet");
    if (!sheet) return;
    sheet.classList.add("hidden");
    sheet.hidden = true;
    document.documentElement.classList.remove("cal-sheet-open");
    clearSheetPos();
    state.editingId = null;
    state.editingRepeatId = null;
    state.deleteArmed = false;
  }

  function openForm(item) {
    fillForm(item);
    $("cal-form").hidden = false;
    $("cal-cook-wrap").hidden = true;
    openSheet();
  }

  function openNutritionSlot(kind, id) {
    const item = (kind === "eat" ? mealEventsOn(state.selected) : cookEventsOn(state.selected))
      .find((e) => e.id === id);
    const plan = nutritionPlan();
    const isEat = kind === "eat";
    $("cal-form").hidden = true;
    $("cal-cook-wrap").hidden = false;
    $("cal-sheet-kicker").textContent = isEat ? "общее мероприятие" : "приготовление еды · Маша";
    $("cal-sheet-title").textContent = item?.title || (isEat ? "Приём пищи" : "Приготовление еды");
    const hint = isEat
      ? "Это время приёма из вкладки Питание. Меняется там — здесь напоминание, когда садиться за стол."
      : "Это слот приготовления из рациона. Меняется в разделе Питание — здесь только напоминание, когда ставить кастрюлю.";
    $("cal-cook-wrap").innerHTML = item
      ? `<p class="cal-cook-meta">${escapeHtml(item.start)} · ${escapeHtml(item.mealType)}${item.cover ? " · на " + escapeHtml(item.cover) : ""}</p>
         <p class="cal-cook-copy">${hint} ${plan.title ? "Рацион «" + escapeHtml(plan.title) + "»." : ""}</p>
         <div class="cal-form-actions">
           <a class="cal-save" href="${PITANIE}">Открыть питание</a>
         </div>`
      : `<p class="cal-cook-copy">Слот уже не найден.</p>`;
    openSheet();
    $("cal-cook-close")?.addEventListener("click", closeSheet);
  }

  function openWeeklySlot(id) {
    const item = weeklyEventsOn(state.selected).find((e) => e.id === id);
    const rule = weeklyRules().find((r) => r.id === item?.ruleId);
    if (!item || !rule) return;
    openForm({
      ...rule,
      date: state.selected,
      start: item.start,
      end: item.end,
      allDay: item.allDay,
      who: rule.who || "",
      repeating: true,
      repeatId: rule.id,
      ruleId: rule.id,
      kind: "week",
    });
  }

  function openNoteSlot(id) {
    const item = noteEventsOn(state.selected).find((e) => e.id === id);
    $("cal-form").hidden = true;
    $("cal-cook-wrap").hidden = false;
    $("cal-sheet-kicker").textContent = item?.who === "sasha" ? "дело Саши из заметок" : "дело Маши из заметок";
    $("cal-sheet-title").textContent = item?.title || "Заметка";
    const details = noteDetailsHtml(item?.details);
    $("cal-cook-wrap").innerHTML = item
      ? `<p class="cal-cook-meta">напоминание · ${escapeHtml(whoLabel(item.who))}${item.done ? " · сделано" : ""}</p>
         ${details}
         <p class="cal-cook-copy">Срок и пояснение живут в заметках. Поменяете там — календарь обновится на всех устройствах.</p>
         <div class="cal-form-actions">
           <a class="cal-save" href="${NOTES}">Открыть заметки</a>
         </div>`
      : `<p class="cal-cook-copy">Дело уже не найдено.</p>`;
    openSheet();
    $("cal-cook-close")?.addEventListener("click", closeSheet);
  }

  function readWho() {
    const el = document.querySelector('input[name="cal-who"]:checked');
    if (el?.value === "sasha") return "sasha";
    if (el?.value === "masha") return "masha";
    return "";
  }

  function saveRepeatRule(payload) {
    const cloudApi = window.SashaCloud;
    if (cloudApi && typeof cloudApi.upsertCalendarRepeat === "function") {
      cloudApi.upsertCalendarRepeat(payload);
    }
  }

  function saveOneOff(event) {
    const cloudApi = window.SashaCloud;
    if (cloudApi && typeof cloudApi.upsertCalendarEvent === "function") {
      cloudApi.upsertCalendarEvent(event);
    }
  }

  function saveEvent(e) {
    e.preventDefault();
    const title = $("cal-title").value.trim();
    const date = $("cal-date").value;
    const allDay = $("cal-allday").checked;
    const start = $("cal-start").value;
    const end = $("cal-end").value;
    const who = readWho();
    const repeating = Boolean($("cal-repeat")?.checked);
    const onlyDay = Boolean($("cal-only-day")?.checked);
    const err = $("cal-error");
    if (!title) {
      err.textContent = "Название — единственное обязательное «что».";
      $("cal-title").focus();
      return;
    }
    if (!date) {
      err.textContent = "Нужна дата.";
      return;
    }
    if (!allDay && !start) {
      err.textContent = "Укажите время начала или включите «весь день».";
      return;
    }
    if (!allDay && start && end && end <= start) {
      err.textContent = "Конец должен быть позже начала — или оставьте поле пустым.";
      return;
    }
    saveWho(who);
    state.selected = date;
    const cloudApi = window.SashaCloud;
    const weekdays = selectedDows();
    const place = $("cal-place").value.trim();
    const note = $("cal-note").value.trim();

    if (repeating && !onlyDay) {
      if (!weekdays.length) {
        err.textContent = "Выберите хотя бы один день недели.";
        return;
      }
      const id = state.editingRepeatId || uid();
      const prev = weeklyRules().find((r) => String(r.id) === String(id));
      saveRepeatRule({
        id,
        title,
        who,
        allDay,
        start: allDay ? "" : start,
        end: allDay ? "" : end,
        place,
        note,
        weekdays,
        exceptions: prev?.exceptions || [],
        deleted: false,
        at: prev?.at || Date.now(),
      });
      if (state.editingId && cloudApi && typeof cloudApi.deleteCalendarEvent === "function") {
        cloudApi.deleteCalendarEvent(state.editingId);
      }
      closeSheet();
      render();
      return;
    }

    if (state.editingRepeatId && (!repeating || onlyDay)) {
      const prev = weeklyRules().find((r) => String(r.id) === String(state.editingRepeatId));
      if (prev) {
        if (!repeating) {
          if (cloudApi && typeof cloudApi.deleteCalendarRepeat === "function") {
            cloudApi.deleteCalendarRepeat(state.editingRepeatId);
          }
        } else {
          saveRepeatRule({
            ...prev,
            exceptions: [...new Set([...(prev.exceptions || []), date])],
          });
        }
      }
    }

    const existing = userEvents().find((item) => String(item.id) === String(state.editingId));
    saveOneOff({
      id: existing?.id || uid(),
      title,
      who,
      date,
      allDay,
      start: allDay ? "" : start,
      end: allDay ? "" : end,
      place,
      note,
      repeatId: onlyDay ? state.editingRepeatId : "",
      at: existing?.at || Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    });
    closeSheet();
    render();
  }

  function deleteEvent() {
    if (!state.editingId && !state.editingRepeatId) return;
    if (!state.deleteArmed) {
      state.deleteArmed = true;
      $("cal-delete").textContent = state.editingRepeatId && !$("cal-only-day")?.checked
        ? "Удалить серию?"
        : "Точно удалить?";
      return;
    }
    const cloudApi = window.SashaCloud;
    const onlyDay = Boolean($("cal-only-day")?.checked);
    if (state.editingRepeatId && onlyDay) {
      const prev = weeklyRules().find((r) => String(r.id) === String(state.editingRepeatId));
      if (prev) {
        saveRepeatRule({
          ...prev,
          exceptions: [...new Set([...(prev.exceptions || []), $("cal-date")?.value || state.selected])],
        });
      }
    } else if (state.editingRepeatId) {
      if (cloudApi && typeof cloudApi.deleteCalendarRepeat === "function") {
        cloudApi.deleteCalendarRepeat(state.editingRepeatId);
      }
    } else if (state.editingId && cloudApi && typeof cloudApi.deleteCalendarEvent === "function") {
      cloudApi.deleteCalendarEvent(state.editingId);
    }
    closeSheet();
    render();
  }

  function bind() {
    $("cal-prev")?.addEventListener("click", () => {
      state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
      render();
    });
    $("cal-next")?.addEventListener("click", () => {
      state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
      render();
    });
    $("cal-today")?.addEventListener("click", () => {
      const now = new Date();
      state.cursor = startOfMonth(now);
      state.selected = isoDate(now);
      render();
    });
    $("cal-allday")?.addEventListener("change", toggleTimes);
    $("cal-repeat")?.addEventListener("change", toggleRepeat);
    $("cal-form")?.addEventListener("submit", saveEvent);
    $("cal-cancel")?.addEventListener("click", closeSheet);
    $("cal-sheet-close")?.addEventListener("click", closeSheet);
    $("cal-delete")?.addEventListener("click", deleteEvent);
    $("cal-sheet")?.addEventListener("click", (e) => {
      if (e.target === $("cal-sheet")) closeSheet();
    });
    window.addEventListener("resize", () => {
      if ($("cal-sheet") && !$("cal-sheet").hidden) placeSheetCard();
    });
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        if ($("cal-sheet") && !$("cal-sheet").hidden) placeSheetCard();
      }, 120);
    });
  }

  window.sashaCalendarReload = render;
  window.SashaCalendar = { render, openCreate: () => openForm(null) };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
