(function (global) {
  const CONFIG_URL = "https://mariasedovav.github.io/sasha-masha/cloud-config.json";
  const GIST_ID = "3ed81968af537a456e6586467e4a7a7a";
  const FILE = "remont-cloud.json";
  const GIST_RAW = "https://gist.githubusercontent.com/MariaSedovaV/" + GIST_ID + "/raw/" + FILE;
  const PAGES_RAW = "https://mariasedovav.github.io/sasha-masha/remont-cloud.json";
  const GIST_API = "https://api.github.com/gists/" + GIST_ID;
  const LOCAL_CLOUD = "sasha-masha-remont-cloud";
  const REMONT_KEY = "sasha-masha-remont";

  const listeners = [];
  let snapshot = empty();
  let storeUrl = "";
  let chain = Promise.resolve();
  let started = false;

  function empty() {
    return { items: [], rev: 0 };
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

  function mergeState(a, b) {
    const left = a || empty();
    const right = b || empty();
    return {
      items: mergeItems(left.items || asItems(left), right.items || asItems(right)),
      rev: Math.max(Number(left.rev || 0), Number(right.rev || 0)),
    };
  }

  function fromLegacy() {
    return { items: asItems(readJson(REMONT_KEY, [])), rev: 0 };
  }

  function persistLocal(state) {
    snapshot = clone(state);
    writeJson(LOCAL_CLOUD, snapshot);
    writeJson(REMONT_KEY, snapshot.items || []);
  }

  function notify() {
    listeners.forEach((fn) => {
      try { fn({ remont: clone(snapshot.items) }); } catch {}
    });
    try { if (typeof global.sashaRemontReload === "function") global.sashaRemontReload(); } catch {}
  }

  async function loadConfig() {
    storeUrl = GIST_RAW;
    try {
      const res = await fetch(CONFIG_URL + "?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const cfg = await res.json();
        if (cfg && cfg.remontRaw) storeUrl = cfg.remontRaw;
        else if (cfg && cfg.raw) storeUrl = String(cfg.raw).replace(/family-cloud\.json$/, FILE);
      }
    } catch {}
    return true;
  }

  async function remoteGet() {
    const urls = [
      (storeUrl || GIST_RAW) + "?t=" + Date.now(),
      PAGES_RAW + "?t=" + Date.now(),
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) continue;
        const data = JSON.parse(await res.text());
        if (data && typeof data === "object") {
          return { items: asItems(data), rev: Number(data.rev || 0) };
        }
      } catch {}
    }
    return empty();
  }

  async function remotePut(state) {
    const encoded = JSON.stringify(state);
    const gistRes = await fetch(GIST_API, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        files: { [FILE]: { content: encoded } },
      }),
    });
    if (gistRes.ok) return true;
    const dispatchRes = await fetch("https://api.github.com/repos/MariaSedovaV/sasha-masha/dispatches", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: "remont-cloud", client_payload: { snapshot: state } }),
    });
    if (dispatchRes.ok || dispatchRes.status === 204) return true;
    throw new Error("cloud-put " + gistRes.status);
  }

  function enqueue(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(() => {}, () => {});
    return run;
  }

  function core(state) {
    return JSON.stringify({ items: state?.items || [] });
  }

  async function pullMergePush(localExtra) {
    let local = mergeState(fromLegacy(), readJson(LOCAL_CLOUD, empty()));
    if (localExtra) local = mergeState(local, localExtra);
    persistLocal(local);

    if (!storeUrl) await loadConfig();

    let remote = empty();
    try { remote = await remoteGet() || empty(); } catch { return snapshot; }

    let merged = mergeState(remote, local);
    persistLocal(merged);
    if (core(merged) === core(remote)) return snapshot;
    merged.rev = Number(merged.rev || 0) + 1;
    persistLocal(merged);
    try {
      await remotePut(merged);
      const check = await remoteGet();
      const again = mergeState(check, merged);
      if (core(again) !== core(merged)) {
        again.rev = Number(again.rev || 0) + 1;
        persistLocal(again);
        await remotePut(again);
      }
    } catch {}
    return snapshot;
  }

  function start() {
    if (started) return;
    started = true;
    snapshot = mergeState(fromLegacy(), readJson(LOCAL_CLOUD, empty()));
    persistLocal(snapshot);
    enqueue(async () => {
      await pullMergePush();
      notify();
    });
    setInterval(() => {
      enqueue(async () => {
        const before = JSON.stringify(snapshot);
        await pullMergePush();
        if (JSON.stringify(snapshot) !== before) notify();
      });
    }, 4000);
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
    snapshot() { return { remont: clone(snapshot.items) }; },
    subscribe(fn) { if (typeof fn === "function") listeners.push(fn); },
    setRemont(list) {
      return applyPatch((s) => { s.items = mergeItems(s.items, list); });
    },
  };

  snapshot = mergeState(fromLegacy(), readJson(LOCAL_CLOUD, empty()));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
