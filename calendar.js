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
  const WHO_KEY = "sasha-masha-calendar-who";
  const PITANIE = "https://mariasedovav.github.io/sasha-masha-pitanie/";

  const state = {
    cursor: startOfMonth(new Date()),
    selected: isoDate(new Date()),
    editingId: null,
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
      return v === "sasha" || v === "masha" ? v : "masha";
    } catch {
      return "masha";
    }
  }

  function saveWho(who) {
    try { localStorage.setItem(WHO_KEY, who); } catch {}
  }

  function whoLabel(who) {
    return who === "sasha" ? "Саша" : "Маша";
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
    return Boolean(plan) && (!pinned || String(plan.rationId) === String(pinned));
  }

  function scheduleLookup(rationId, dayId, mealId) {
    const key = "r" + rationId + "|" + dayId + "|" + mealId;
    const custom = cloud().schedules?.[key];
    if (custom && !custom.deleted) return custom;
    return null;
  }

  function buildPlanFromIndex(pinned, plan) {
    const ration = (window.COOKING_INDEX || []).find((r) => String(r.id) === String(pinned));
    if (!ration) {
      return {
        rationId: pinned || null,
        title: plan?.title || "",
        items: plan?.items || [],
        meals: plan?.meals || [],
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
        if (isMain || isBreakfast) {
          let cookDay = day.id;
          let time = "07:30";
          let cover = "";
          let kind = "same-day";
          if (isMain) {
            const block = COOK_BLOCKS[day.id] || COOK_BLOCKS.ВС;
            cookDay = block.cookDay;
            time = block.cookTime;
            cover = block.cover;
            kind = "batch";
          }
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
              items.push({
                weekday: cookDay,
                time,
                mealType: meal.id,
                title: meal.title,
                cover,
                kind,
                eatDay: day.id,
              });
            }
          }
        }
        const eatTime = custom?.eat?.time || EAT_TIMES[meal.id] || "12:00";
        const eatDay = custom?.eat?.dayId || day.id;
        if (eatTime) {
          meals.push({
            weekday: eatDay,
            time: eatTime,
            mealType: meal.id,
            title: meal.title,
          });
        }
      });
    });
    return { rationId: ration.id, title: ration.title, items, meals };
  }

  function nutritionPlan() {
    const snap = cloud();
    const pinned = snap.pinned?.id;
    const plan = snap.cookingPlan;
    const fromCloud = planMatchesPinned(plan, pinned);
    const cloudCook = fromCloud && Array.isArray(plan.items) && plan.items.length ? plan.items : null;
    const cloudMeals = fromCloud && Array.isArray(plan.meals) && plan.meals.length ? plan.meals : null;
    if (cloudCook && cloudMeals) {
      return { rationId: plan.rationId, title: plan.title || "", items: cloudCook, meals: cloudMeals };
    }
    if (!pinned && !cloudCook && !cloudMeals) return { rationId: null, title: "", items: [], meals: [] };
    const built = buildPlanFromIndex(pinned, plan);
    return {
      rationId: built.rationId,
      title: built.title || plan?.title || "",
      items: cloudCook || built.items,
      meals: cloudMeals || built.meals,
    };
  }

  function userEvents() {
    return (cloud().calendar || []).filter((e) => e && !e.deleted);
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

  function marksFor(iso) {
    const cook = cookEventsOn(iso).length > 0;
    const eat = mealEventsOn(iso).length > 0;
    const users = userEventsOn(iso);
    return {
      cook,
      eat,
      masha: users.some((e) => e.who === "masha"),
      sasha: users.some((e) => e.who === "sasha"),
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
        marks.cook ? '<i class="dot cook" title="Приготовление еды"></i>' : "",
        marks.eat ? '<i class="dot eat" title="Приём пищи"></i>' : "",
        marks.masha ? '<i class="dot masha" title="Маша"></i>' : "",
        marks.sasha ? '<i class="dot sasha" title="Саша"></i>' : "",
      ].join("");
      return `<button type="button" class="${cls}" data-date="${iso}" aria-pressed="${iso === state.selected}">
        <span class="cal-num">${d.getDate()}</span>
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
    const users = userEventsOn(state.selected);
    const rows = [...cook, ...meals, ...users].sort((a, b) => timeKey(a).localeCompare(timeKey(b)));
    const listHtml = rows.length
      ? rows.map((item) => {
        if (item.kind === "cook") {
          const cover = item.cover ? ` на ${escapeHtml(item.cover)}` : "";
          const batch = item.cookKind === "same-day" ? "в тот же день" : "партия" + cover;
          return `<button type="button" class="cal-item cook" data-cook="${escapeHtml(item.id)}">
            <span class="cal-item-time">${escapeHtml(item.start)}</span>
            <span class="cal-item-body">
              <em>Приготовление еды · ${escapeHtml(item.mealType)}</em>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${batch}</small>
            </span>
          </button>`;
        }
        if (item.kind === "eat") {
          return `<button type="button" class="cal-item eat" data-eat="${escapeHtml(item.id)}">
            <span class="cal-item-time">${escapeHtml(item.start)}</span>
            <span class="cal-item-body">
              <em>Приём пищи · ${escapeHtml(item.mealType)}</em>
              <strong>${escapeHtml(item.title)}</strong>
            </span>
          </button>`;
        }
        return `<button type="button" class="cal-item ${item.who || "masha"}" data-id="${escapeHtml(item.id)}">
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
        <span><i class="dot cook"></i> Приготовление еды</span>
        <span><i class="dot eat"></i> Приём пищи</span>
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

  function fillForm(item) {
    const isEdit = Boolean(item);
    state.editingId = item?.id || null;
    state.deleteArmed = false;
    $("cal-sheet-kicker").textContent = isEdit ? "правка события" : "новое событие";
    $("cal-sheet-title").textContent = isEdit ? "Что меняем" : "Что заносим";
    $("cal-title").value = item?.title || "";
    $("cal-date").value = item?.date || state.selected;
    $("cal-start").value = item?.start || nextHour();
    $("cal-end").value = item?.end || "";
    $("cal-allday").checked = Boolean(item?.allDay);
    $("cal-place").value = item?.place || "";
    $("cal-note").value = item?.note || "";
    const who = item?.who || lastWho();
    document.querySelectorAll('input[name="cal-who"]').forEach((el) => {
      el.checked = el.value === who;
    });
    $("cal-error").textContent = "";
    $("cal-delete").hidden = !isEdit;
    $("cal-delete").textContent = "Удалить";
    toggleTimes();
  }

  function openSheet() {
    const sheet = $("cal-sheet");
    if (!sheet) return;
    sheet.classList.remove("hidden");
    sheet.hidden = false;
    document.documentElement.classList.add("cal-sheet-open");
    setTimeout(() => $("cal-title")?.focus(), 40);
  }

  function closeSheet() {
    const sheet = $("cal-sheet");
    if (!sheet) return;
    sheet.classList.add("hidden");
    sheet.hidden = true;
    document.documentElement.classList.remove("cal-sheet-open");
    state.editingId = null;
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
    $("cal-sheet-kicker").textContent = isEat ? "приём пищи из рациона" : "приготовление еды из рациона";
    $("cal-sheet-title").textContent = item?.title || (isEat ? "Приём пищи" : "Приготовление еды");
    const hint = isEat
      ? "Это время приёма из вкладки Питание. Меняется там — здесь напоминание, когда садиться за стол."
      : "Это слот приготовления из рациона. Меняется в разделе Питание — здесь только напоминание, когда ставить кастрюлю.";
    $("cal-cook-wrap").innerHTML = item
      ? `<p class="cal-cook-meta">${escapeHtml(item.start)} · ${escapeHtml(item.mealType)}${item.cover ? " · на " + escapeHtml(item.cover) : ""}</p>
         <p class="cal-cook-copy">${hint} ${plan.title ? "Рацион «" + escapeHtml(plan.title) + "»." : ""}</p>
         <div class="cal-form-actions">
           <a class="cal-save" href="${PITANIE}">Открыть питание</a>
           <button type="button" class="cal-cancel" id="cal-cook-close">Закрыть</button>
         </div>`
      : `<p class="cal-cook-copy">Слот уже не найден.</p>`;
    openSheet();
    $("cal-cook-close")?.addEventListener("click", closeSheet);
  }

  function readWho() {
    const el = document.querySelector('input[name="cal-who"]:checked');
    return el?.value === "sasha" ? "sasha" : "masha";
  }

  function saveEvent(e) {
    e.preventDefault();
    const title = $("cal-title").value.trim();
    const date = $("cal-date").value;
    const allDay = $("cal-allday").checked;
    const start = $("cal-start").value;
    const end = $("cal-end").value;
    const who = readWho();
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
    const existing = userEvents().find((item) => String(item.id) === String(state.editingId));
    const event = {
      id: existing?.id || uid(),
      title,
      who,
      date,
      allDay,
      start: allDay ? "" : start,
      end: allDay ? "" : end,
      place: $("cal-place").value.trim(),
      note: $("cal-note").value.trim(),
      at: existing?.at || Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };
    state.selected = date;
    const cloudApi = window.SashaCloud;
    if (cloudApi && typeof cloudApi.upsertCalendarEvent === "function") {
      cloudApi.upsertCalendarEvent(event);
    }
    closeSheet();
    render();
  }

  function deleteEvent() {
    if (!state.editingId) return;
    if (!state.deleteArmed) {
      state.deleteArmed = true;
      $("cal-delete").textContent = "Точно удалить?";
      return;
    }
    const cloudApi = window.SashaCloud;
    if (cloudApi && typeof cloudApi.deleteCalendarEvent === "function") {
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
    $("cal-form")?.addEventListener("submit", saveEvent);
    $("cal-cancel")?.addEventListener("click", closeSheet);
    $("cal-sheet-close")?.addEventListener("click", closeSheet);
    $("cal-delete")?.addEventListener("click", deleteEvent);
    $("cal-sheet")?.addEventListener("click", (e) => {
      if (e.target === $("cal-sheet")) closeSheet();
    });
  }

  window.sashaCalendarReload = render;
  window.SashaCalendar = { render, openCreate: () => openForm(null) };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
