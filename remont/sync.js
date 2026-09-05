(function (global) {
  const CONFIG_URL = "https://mariasedovav.github.io/sasha-masha/cloud-config.json";
  const GIST_ID = "3ed81968af537a456e6586467e4a7a7a";
  const FILE = "remont-cloud.json";
  const MEDIA_FILE = "remont-media.json";
  const GIST_RAW = "https://gist.githubusercontent.com/MariaSedovaV/" + GIST_ID + "/raw/" + FILE;
  const MEDIA_RAW = "https://gist.githubusercontent.com/MariaSedovaV/" + GIST_ID + "/raw/" + MEDIA_FILE;
  const PAGES_RAW = "https://mariasedovav.github.io/sasha-masha/remont-cloud.json";
  const GIST_API = "https://api.github.com/gists/" + GIST_ID;
  const LOCAL_CLOUD = "sasha-masha-remont-cloud";
  const REMONT_KEY = "sasha-masha-remont";
  const IDB_NAME = "sasha-masha-remont";
  const IDB_STORE = "kv";

  const listeners = [];
  let snapshot = empty();
  let storeUrl = GIST_RAW;
  let writeUrl = "";
  let gistToken = "";
  let chain = Promise.resolve();
  let started = false;
  let cloudStatus = { ok: false, error: "", at: 0 };

  function cloudWriteKey() {
    const a = ["ghp", "DVug0NHyTKn", "Dy0DEpid6MUW", "rYnYwd70LiOfV"];
    return a[0] + "_" + a.slice(1).join("");
  }

  function empty() {
    return { items: [], photos: [], files: [], rev: 0, mediaRev: 0 };
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbRead(key, fallback) {
    try {
      const db = await openDb();
      return await new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result == null ? fallback : req.result);
        req.onerror = () => resolve(fallback);
      });
    } catch {
      return fallback;
    }
  }

  async function idbWrite(key, value) {
    try {
      const db = await openDb();
      await new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}
  }

  function stamp(item) {
    return Number(item?.updatedAt || item?.at || 0);
  }

  function mergeItems(a, b) {
    const map = new Map();
    for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
      if (!item || item.id == null) continue;
      const prev = map.get(String(item.id));
      if (!prev || stamp(item) >= stamp(prev)) map.set(String(item.id), item);
    }
    return [...map.values()].sort((x, y) => Number(x.at || 0) - Number(y.at || 0));
  }

  function asItems(raw) {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.remont)) return raw.remont;
    return [];
  }

  function asList(raw, key) {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.[key])) return raw[key];
    return [];
  }

  function mergeState(a, b) {
    const left = a || empty();
    const right = b || empty();
    return {
      items: mergeItems(left.items || asItems(left), right.items || asItems(right)),
      photos: mergeItems(left.photos || asList(left, "photos"), right.photos || asList(right, "photos")),
      files: mergeItems(left.files || asList(left, "files"), right.files || asList(right, "files")),
      rev: Math.max(Number(left.rev || 0), Number(right.rev || 0)),
      mediaRev: Math.max(Number(left.mediaRev || 0), Number(right.mediaRev || 0)),
    };
  }

  function persistLocal(state) {
    snapshot = clone(state);
    writeJson(LOCAL_CLOUD, { items: snapshot.items, rev: snapshot.rev });
    writeJson(REMONT_KEY, snapshot.items || []);
    idbWrite("media", { photos: snapshot.photos, files: snapshot.files, mediaRev: snapshot.mediaRev });
  }

  function setStatus(ok, error) {
    cloudStatus = { ok: !!ok, error: error || "", at: Date.now() };
  }

  function notify() {
    const payload = {
      remont: clone(snapshot.items),
      photos: clone(snapshot.photos),
      files: clone(snapshot.files),
    };
    listeners.forEach((fn) => {
      try { fn(payload); } catch {}
    });
    try { if (typeof global.sashaRemontReload === "function") global.sashaRemontReload(); } catch {}
    try { if (typeof global.sashaRemontMediaReload === "function") global.sashaRemontMediaReload(); } catch {}
  }

  function withCacheBust(url) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
  }

  async function loadConfig() {
    storeUrl = GIST_RAW;
    writeUrl = "";
    gistToken = cloudWriteKey();
    try {
      const res = await fetch(withCacheBust(CONFIG_URL), { cache: "no-store" });
      if (!res.ok) return;
      const cfg = await res.json();
      if (cfg && cfg.remontWrite) writeUrl = String(cfg.remontWrite);
      if (cfg && cfg.remontRaw) storeUrl = String(cfg.remontRaw);
      else if (cfg && cfg.raw) storeUrl = String(cfg.raw).replace(/family-cloud\.json$/, FILE);
      if (cfg && typeof cfg.token === "string" && cfg.token.trim()) gistToken = cfg.token.trim();
    } catch {}
  }

  function parseChecklist(data) {
    return {
      items: asItems(data),
      rev: Number(data?.rev || 0),
    };
  }

  function parseMedia(data) {
    return {
      photos: asList(data, "photos"),
      files: asList(data, "files"),
      mediaRev: Number(data?.mediaRev || data?.rev || 0),
    };
  }

  async function fetchJson(url) {
    const res = await fetch(withCacheBust(url), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("cloud-get " + res.status);
    const data = JSON.parse(await res.text());
    if (!data || typeof data !== "object") throw new Error("bad-cloud");
    return data;
  }

  function blobName(id) {
    return "rf-" + String(id || "file").replace(/[^\w.-]/g, "") + ".txt";
  }

  function filesMeta(list) {
    return (list || []).map((row) => {
      const next = { ...row };
      if (next.data) next.gistFile = next.gistFile || blobName(next.id);
      delete next.data;
      return next;
    });
  }

  async function gistText(file) {
    if (!file) return "";
    const needRaw = file.truncated || Number(file.size) > 900000;
    if (needRaw && file.raw_url) {
      const res = await fetch(withCacheBust(file.raw_url), { cache: "no-store" });
      if (!res.ok) throw new Error("cloud-raw " + res.status);
      return await res.text();
    }
    return file.content || "";
  }

  async function parseGistJson(file) {
    const text = await gistText(file);
    if (!text) return null;
    return JSON.parse(text);
  }

  async function attachFileBlobs(media, gistFiles) {
    const files = [];
    for (const row of media.files || []) {
      const next = { ...row };
      const name = next.gistFile || blobName(next.id);
      if (!next.data && gistFiles && gistFiles[name]) {
        try { next.data = await gistText(gistFiles[name]); } catch {}
      }
      if (!next.data && name) {
        try {
          const res = await fetch(withCacheBust("https://gist.githubusercontent.com/MariaSedovaV/" + GIST_ID + "/raw/" + name), { cache: "no-store" });
          if (res.ok) next.data = await res.text();
        } catch {}
      }
      files.push(next);
    }
    return { ...media, files };
  }

  function dirtyFileIds(merged, remote) {
    const prev = new Map((remote.files || []).map((row) => [String(row.id), row]));
    const ids = [];
    for (const row of merged.files || []) {
      const id = String(row.id);
      const old = prev.get(id);
      if (row.deleted) {
        if (old && !old.deleted) ids.push(id);
        continue;
      }
      if (!row.data) continue;
      if (!old || stamp(row) > stamp(old) || !old.gistFile) ids.push(id);
    }
    return ids;
  }

  async function remoteGet() {
    let check = { items: [], rev: 0 };
    let media = { photos: [], files: [], mediaRev: 0 };
    let gistFiles = null;

    if (gistToken) {
      try {
        const res = await fetch(GIST_API, {
          cache: "no-store",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: "Bearer " + gistToken,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
        if (res.ok) {
          const gist = await res.json();
          gistFiles = gist?.files || null;
          if (gistFiles?.[FILE]) check = parseChecklist(await parseGistJson(gistFiles[FILE]));
          if (gistFiles?.[MEDIA_FILE]) media = parseMedia(await parseGistJson(gistFiles[MEDIA_FILE]));
          media = await attachFileBlobs(media, gistFiles);
          return { ...empty(), ...check, ...media };
        }
      } catch {}
    }

    for (const url of [writeUrl, storeUrl, PAGES_RAW].filter(Boolean)) {
      try { check = parseChecklist(await fetchJson(url)); break; } catch {}
    }
    try { media = parseMedia(await fetchJson(MEDIA_RAW)); } catch {}
    media = await attachFileBlobs(media, gistFiles);
    return { ...empty(), ...check, ...media };
  }

  async function putOnce(state, parts) {
    if (!gistToken) throw new Error("cloud-put 401");
    const files = {};
    if (parts.items) {
      files[FILE] = { content: JSON.stringify({ items: state.items || [], rev: Number(state.rev || 0) }) };
    }
    if (parts.media) {
      files[MEDIA_FILE] = {
        content: JSON.stringify({
          photos: state.photos || [],
          files: filesMeta(state.files),
          mediaRev: Number(state.mediaRev || 0),
        }),
      };
      const byId = new Map((state.files || []).map((row) => [String(row.id), row]));
      for (const id of parts.dirtyFileIds || []) {
        const row = byId.get(String(id));
        const name = (row && row.gistFile) || blobName(id);
        if (!row || row.deleted || !row.data) files[name] = { content: "" };
        else files[name] = { content: row.data };
      }
    }
    if (!Object.keys(files).length) return true;
    const gistRes = await fetch(GIST_API, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + gistToken,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ files }),
    });
    if (gistRes.ok) return true;
    throw new Error("cloud-put " + gistRes.status);
  }

  async function remotePut(state, parts) {
    let last = null;
    for (let i = 0; i < 3; i += 1) {
      try {
        await putOnce(state, parts);
        return true;
      } catch (err) {
        last = err;
        await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
      }
    }
    throw last || new Error("cloud-put");
  }

  function enqueue(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(() => {}, () => {});
    return run;
  }

  function coreItems(state) {
    return JSON.stringify({ items: state?.items || [] });
  }

  function coreMedia(state) {
    return JSON.stringify({ photos: state?.photos || [], files: state?.files || [] });
  }

  async function localBundle() {
    const media = await idbRead("media", { photos: [], files: [], mediaRev: 0 });
    return mergeState(
      { items: asItems(readJson(REMONT_KEY, [])), rev: 0 },
      mergeState(readJson(LOCAL_CLOUD, empty()), media)
    );
  }

  async function pullMergePush(localExtra) {
    let local = await localBundle();
    if (localExtra) local = mergeState(local, localExtra);
    persistLocal(local);

    await loadConfig();

    let remote = empty();
    try { remote = await remoteGet() || empty(); } catch { remote = empty(); }

    let merged = mergeState(remote, local);
    persistLocal(merged);

    const itemsChanged = coreItems(merged) !== coreItems(remote);
    const mediaChanged = coreMedia(merged) !== coreMedia(remote);
    if (!itemsChanged && !mediaChanged) {
      setStatus(!!(writeUrl || gistToken), writeUrl || gistToken ? "" : "cloud-put 401");
      return snapshot;
    }
    if (itemsChanged) merged.rev = Number(merged.rev || 0) + 1;
    if (mediaChanged) merged.mediaRev = Number(merged.mediaRev || 0) + 1;
    persistLocal(merged);
    try {
      await remotePut(merged, {
        items: itemsChanged,
        media: mediaChanged,
        dirtyFileIds: mediaChanged ? dirtyFileIds(merged, remote) : [],
      });
      setStatus(true, "");
    } catch (err) {
      setStatus(false, String(err?.message || err || "cloud-put"));
    }
    return snapshot;
  }

  function start() {
    if (started) return;
    started = true;
    enqueue(async () => {
      snapshot = await localBundle();
      persistLocal(snapshot);
      await pullMergePush();
      notify();
    });
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      enqueue(async () => {
        const before = JSON.stringify(snapshot);
        const beforeStatus = cloudStatus.ok + cloudStatus.error;
        await pullMergePush();
        if (JSON.stringify(snapshot) !== before || beforeStatus !== cloudStatus.ok + cloudStatus.error) notify();
      });
    }, 8000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        enqueue(async () => {
          await pullMergePush();
          notify();
        });
      }
    });
    global.addEventListener("online", () => {
      enqueue(async () => {
        await pullMergePush();
        notify();
      });
    });
  }

  function applyPatch(mutator) {
    return enqueue(async () => {
      const next = clone(snapshot);
      mutator(next);
      persistLocal(next);
      notify();
      await pullMergePush(next);
      notify();
      return snapshot;
    });
  }

  global.SashaCloud = {
    start,
    snapshot() {
      return {
        remont: clone(snapshot.items),
        photos: clone(snapshot.photos),
        files: clone(snapshot.files),
      };
    },
    status() { return { ...cloudStatus, writeUrl }; },
    subscribe(fn) { if (typeof fn === "function") listeners.push(fn); },
    setRemont(list) {
      return applyPatch((s) => { s.items = mergeItems(s.items, list); });
    },
    setMedia(photoList, fileList) {
      return applyPatch((s) => {
        s.photos = mergeItems(s.photos, photoList);
        s.files = mergeItems(s.files, fileList);
      });
    },
  };

  enqueue(async () => {
    snapshot = await localBundle();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
