(function () {
  const PHOTO_MAX = 1100;
  const FILE_MAX = 18000000;

  let photos = [];
  let files = [];
  let photoRoom = "";
  let pendingImages = [];
  let lightboxId = "";
  let saveTimer = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function rooms() {
    return window.REMONT_ROOMS || [];
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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

  function stamp(item) {
    return Number(item?.updatedAt || item?.at || 0);
  }

  function mergeById(a, b) {
    const map = new Map();
    for (const item of [...(a || []), ...(b || [])]) {
      if (!item || item.id == null) continue;
      const prev = map.get(String(item.id));
      if (!prev || stamp(item) >= stamp(prev)) map.set(String(item.id), item);
    }
    return [...map.values()].sort((x, y) => Number(x.at || 0) - Number(y.at || 0));
  }

  function cloudMedia() {
    try {
      const snap = window.SashaCloud && window.SashaCloud.snapshot && window.SashaCloud.snapshot();
      return {
        photos: Array.isArray(snap?.photos) ? snap.photos : [],
        files: Array.isArray(snap?.files) ? snap.files : [],
      };
    } catch {
      return { photos: [], files: [] };
    }
  }

  function persist() {
    if (!window.SashaCloud || typeof window.SashaCloud.setMedia !== "function") return;
    window.SashaCloud.setMedia(photos, files);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 240);
  }

  function alive(list) {
    return (list || []).filter((row) => row && !row.deleted);
  }

  function visiblePhotos() {
    return alive(photos).filter((row) => !photoRoom || row.room === photoRoom);
  }

  function bytes(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + " МБ";
    if (n >= 1000) return Math.round(n / 1000) + " КБ";
    return n + " Б";
  }

  function renderPhotoFilters() {
    const root = $("photo-filters");
    if (!root) return;
    root.innerHTML = rooms().map((room) => {
      const on = photoRoom === room ? " on" : "";
      return `<button type="button" class="filter-chip${on}" data-photo-room="${escapeHtml(room)}">${escapeHtml(room)}</button>`;
    }).join("");
  }

  function renderPhotos() {
    const grid = $("photo-grid");
    const empty = $("photo-empty");
    if (!grid) return;
    const rows = visiblePhotos();
    if (empty) empty.hidden = rows.length > 0;
    grid.innerHTML = rows.map((row) => `
      <article class="pin" data-id="${escapeHtml(row.id)}">
        <button type="button" class="pin-open" data-open="${escapeHtml(row.id)}" aria-label="Открыть фото">
          <img src="${row.data}" alt="${escapeHtml(row.caption || row.room || "фото")}" />
        </button>
        <div class="pin-meta">
          <span class="pin-tag">${escapeHtml(row.room || "комната")}</span>
          ${row.caption ? `<span class="pin-cap">${escapeHtml(row.caption)}</span>` : ""}
        </div>
        <button type="button" class="pin-del" data-del-photo="${escapeHtml(row.id)}" aria-label="Удалить фото">×</button>
      </article>
    `).join("");
  }

  function renderFiles() {
    const list = $("file-list");
    const empty = $("file-empty");
    if (!list) return;
    const rows = alive(files);
    if (empty) empty.hidden = rows.length > 0;
    list.innerHTML = rows.map((row) => `
      <li class="file-row">
        <div>
          <strong>${escapeHtml(row.name)}</strong>
          <small>${escapeHtml(row.type || "файл")} · ${bytes(row.size || 0)}</small>
        </div>
        <div class="file-row-actions">
          <button type="button" class="add-btn" data-download="${escapeHtml(row.id)}">Скачать</button>
          <button type="button" class="danger-btn" data-del-file="${escapeHtml(row.id)}">Удалить</button>
        </div>
      </li>
    `).join("");
  }

  function renderAll() {
    renderPhotoFilters();
    renderPhotos();
    renderFiles();
  }

  function loadMedia() {
    const cloud = cloudMedia();
    photos = mergeById(photos, cloud.photos);
    files = mergeById(files, cloud.files);
    renderAll();
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) {
          URL.revokeObjectURL(url);
          reject(new Error("bad-image"));
          return;
        }
        if (Math.max(w, h) > PHOTO_MAX) {
          const scale = PHOTO_MAX / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.68));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("bad-image"));
      };
      img.src = url;
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (file.size > FILE_MAX) {
        reject(new Error("too-big"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    });
  }

  function bindDrop(zone, input, onFiles) {
    if (!zone || !input) return;
    zone.addEventListener("click", (e) => {
      if (e.target === input) return;
      input.click();
    });
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("on");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("on"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("on");
      onFiles(e.dataTransfer && e.dataTransfer.files);
    });
    input.addEventListener("change", () => {
      onFiles(input.files);
      input.value = "";
    });
  }

  function openSheet(images) {
    pendingImages = images;
    const sheet = $("photo-sheet");
    const roomsRoot = $("sheet-rooms");
    const preview = $("sheet-preview");
    const error = $("sheet-error");
    const caption = $("photo-caption");
    if (!sheet || !roomsRoot) return;
    if (caption) caption.value = "";
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
    roomsRoot.innerHTML = rooms().map((room) => (
      `<button type="button" class="filter-chip${room === "Кухня-гостиная" ? " on" : ""}" data-sheet-room="${escapeHtml(room)}">${escapeHtml(room)}</button>`
    )).join("");
    roomsRoot.dataset.room = "Кухня-гостиная";
    if (preview) {
      preview.innerHTML = images.map((item) => `<img src="${item.data}" alt="" />`).join("");
    }
    if (typeof sheet.showModal === "function") sheet.showModal();
    else sheet.setAttribute("open", "");
  }

  function closeSheet() {
    const sheet = $("photo-sheet");
    pendingImages = [];
    if (!sheet) return;
    if (typeof sheet.close === "function") sheet.close();
    else sheet.removeAttribute("open");
  }

  async function takePhotos(list) {
    const picked = [...(list || [])].filter((file) => file && file.type.indexOf("image/") === 0);
    if (!picked.length) return;
    const ready = [];
    for (const file of picked) {
      try {
        ready.push({ name: file.name, data: await compressImage(file) });
      } catch {
        const error = $("sheet-error");
        if (error) {
          error.hidden = false;
          error.textContent = "Это фото не получилось прочитать. Попробуйте JPG или PNG.";
        }
      }
    }
    if (ready.length) openSheet(ready);
  }

  async function takeFiles(list) {
    const picked = [...(list || [])];
    if (!picked.length) return;
    const now = Date.now();
    for (const file of picked) {
      try {
        const data = await readFile(file);
        files.push({
          id: uid("f-"),
          name: file.name || "файл",
          type: file.type || "файл",
          size: file.size || 0,
          data,
          deleted: false,
          at: now,
          updatedAt: now,
        });
      } catch (err) {
        window.alert(err && err.message === "too-big"
          ? "Файл больше 18 МБ. Сожмите его или разбейте на части."
          : "Этот файл не удалось загрузить.");
      }
    }
    renderFiles();
    persist();
  }

  function downloadFile(id) {
    const row = files.find((item) => item.id === id && !item.deleted);
    if (!row || !row.data) return;
    let href = row.data;
    let revoke = "";
    try {
      const parts = String(row.data).split(",");
      const mime = (parts[0].match(/data:([^;]+)/) || [, "application/octet-stream"])[1];
      const bin = atob(parts[1] || "");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      revoke = URL.createObjectURL(new Blob([bytes], { type: mime }));
      href = revoke;
    } catch {}
    const a = document.createElement("a");
    a.href = href;
    a.download = row.name || "файл";
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 1500);
  }

  function removePhoto(id) {
    const row = photos.find((item) => item.id === id);
    if (!row) return false;
    if (!window.confirm("Удалить это фото? На других устройствах оно тоже исчезнет.")) return false;
    row.deleted = true;
    row.updatedAt = Date.now();
    renderPhotos();
    persist();
    return true;
  }

  function removeFile(id) {
    const row = files.find((item) => item.id === id);
    if (!row) return;
    if (!window.confirm("Удалить файл «" + (row.name || "без имени") + "»?")) return;
    row.deleted = true;
    row.updatedAt = Date.now();
    renderFiles();
    persist();
  }

  function lightboxList() {
    return visiblePhotos();
  }

  function fillLightbox(id) {
    const rows = lightboxList();
    const index = rows.findIndex((item) => item.id === id);
    const row = index >= 0 ? rows[index] : photos.find((item) => item.id === id && !item.deleted);
    const box = $("lightbox");
    if (!row || !box) return false;
    lightboxId = row.id;
    $("lightbox-img").src = row.data;
    $("lightbox-img").alt = row.caption || row.room || "";
    $("lightbox-room").textContent = row.room || "";
    $("lightbox-caption").textContent = row.caption || "";
    const count = $("lightbox-count");
    if (count) count.textContent = rows.length ? (index + 1) + " из " + rows.length : "";
    const many = rows.length > 1;
    $("lightbox-prev")?.classList.toggle("is-hidden", !many);
    $("lightbox-next")?.classList.toggle("is-hidden", !many);
    return true;
  }

  function openLightbox(id) {
    const box = $("lightbox");
    if (!fillLightbox(id) || !box) return;
    if (typeof box.showModal === "function") {
      if (!box.open) box.showModal();
    } else box.setAttribute("open", "");
  }

  function stepLightbox(dir) {
    const rows = lightboxList();
    if (rows.length < 2) return;
    const index = rows.findIndex((item) => item.id === lightboxId);
    const next = rows[(index + dir + rows.length) % rows.length];
    if (next) fillLightbox(next.id);
  }

  function closeLightbox() {
    const box = $("lightbox");
    lightboxId = "";
    if (!box) return;
    if (typeof box.close === "function") box.close();
    else box.removeAttribute("open");
  }

  function boot() {
    renderAll();
    loadMedia();

    $("add-photos").addEventListener("click", () => $("photo-input").click());
    $("add-files").addEventListener("click", () => $("file-input").click());
    bindDrop($("photo-drop"), $("photo-input"), takePhotos);
    bindDrop($("file-drop"), $("file-input"), takeFiles);

    $("photo-filters").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-photo-room]");
      if (!btn) return;
      const next = btn.dataset.photoRoom || "";
      photoRoom = photoRoom === next ? "" : next;
      renderPhotoFilters();
      renderPhotos();
    });
    $("reset-photo-filters").addEventListener("click", () => {
      photoRoom = "";
      renderPhotoFilters();
      renderPhotos();
    });

    $("photo-grid").addEventListener("click", (e) => {
      const del = e.target.closest("[data-del-photo]");
      if (del) {
        removePhoto(del.dataset.delPhoto);
        return;
      }
      const open = e.target.closest("[data-open]");
      if (open) openLightbox(open.dataset.open);
    });

    $("file-list").addEventListener("click", (e) => {
      const down = e.target.closest("[data-download]");
      if (down) {
        downloadFile(down.dataset.download);
        return;
      }
      const del = e.target.closest("[data-del-file]");
      if (del) removeFile(del.dataset.delFile);
    });

    $("sheet-rooms").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sheet-room]");
      if (!btn) return;
      $("sheet-rooms").dataset.room = btn.dataset.sheetRoom;
      $("sheet-rooms").querySelectorAll(".filter-chip").forEach((chip) => {
        chip.classList.toggle("on", chip === btn);
      });
    });
    $("sheet-cancel").addEventListener("click", closeSheet);
    $("photo-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const room = $("sheet-rooms").dataset.room || "Кухня-гостиная";
      const caption = String($("photo-caption").value || "").trim();
      const now = Date.now();
      pendingImages.forEach((item, i) => {
        photos.push({
          id: uid("p-"),
          room,
          caption,
          name: item.name || "фото",
          data: item.data,
          deleted: false,
          at: now + i,
          updatedAt: now + i,
        });
      });
      closeSheet();
      renderPhotos();
      persist();
    });

    $("lightbox-close").addEventListener("click", closeLightbox);
    $("lightbox-prev").addEventListener("click", (e) => {
      e.stopPropagation();
      stepLightbox(-1);
    });
    $("lightbox-next").addEventListener("click", (e) => {
      e.stopPropagation();
      stepLightbox(1);
    });
    $("lightbox-del").addEventListener("click", () => {
      if (!lightboxId) return;
      const rows = lightboxList();
      const index = rows.findIndex((item) => item.id === lightboxId);
      if (!removePhoto(lightboxId)) return;
      const next = lightboxList();
      if (!next.length) {
        closeLightbox();
        return;
      }
      fillLightbox(next[Math.min(index, next.length - 1)].id);
    });
    $("lightbox").addEventListener("click", (e) => {
      if (e.target.id === "lightbox") closeLightbox();
    });
    let swipeX = 0;
    $("lightbox").addEventListener("touchstart", (e) => {
      swipeX = e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
    }, { passive: true });
    $("lightbox").addEventListener("touchend", (e) => {
      const x = e.changedTouches[0] ? e.changedTouches[0].clientX : swipeX;
      const dx = x - swipeX;
      if (Math.abs(dx) < 50) return;
      stepLightbox(dx < 0 ? 1 : -1);
    }, { passive: true });
    document.addEventListener("keydown", (e) => {
      const box = $("lightbox");
      if (!box || (!box.open && !box.hasAttribute("open"))) return;
      if (e.key === "ArrowRight") stepLightbox(1);
      if (e.key === "ArrowLeft") stepLightbox(-1);
    });

    window.sashaRemontMediaReload = function () {
      const cloud = cloudMedia();
      photos = mergeById(photos, cloud.photos);
      files = mergeById(files, cloud.files);
      renderAll();
    };

    if (window.SashaCloud && typeof window.SashaCloud.subscribe === "function") {
      window.SashaCloud.subscribe(() => window.sashaRemontMediaReload());
    }
    setTimeout(loadMedia, 800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
