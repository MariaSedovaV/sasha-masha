(function (global) {
  const CONFIG_URL = "https://mariasedovav.github.io/sasha-masha/cloud-config.json";
  const FILE = "remont-cloud.json";
  const GIST_RAW = "https://gist.githubusercontent.com/MariaSedovaV/3ed81968af537a456e6586467e4a7a7a/raw/" + FILE;
  const PAGES_RAW = "https://mariasedovav.github.io/sasha-masha/remont-cloud.json";
  const DEFAULT_WRITES = [
    "https://api.jsonstorage.net/v1/json/7f3a9c1e2b8d4e0f9a6c5d4b3a2e1f08/remont",
    "https://jsonblob.io/b8e1c4d2-90a7-4f3b-8c16-6e2a0f1d7c59",
  ];
  const LOCAL_CLOUD = "sasha-masha-remont-cloud";
  const REMONT_KEY = "sasha-masha-remont";

  const listeners = [];
  let snapshot = empty();
  let storeUrl = GIST_RAW;
  let writeUrl = DEFAULT_WRITES[0];
  let chain = Promise.resolve();
  let started = false;
  let cloudStatus = { ok: false, error: "", at: 0 };

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

  function persistLocal(state) {
    snapshot = clone(state);
    writeJson(LOCAL_CLOUD, snapshot);
    writeJson(REMONT_KEY, snapshot.items || []);
  }

  function setStatus(ok, error) {
    cloudStatus = { ok: !!ok, error: error || "", at: Date.now() };
  }

  function notify() {
    listeners.forEach((fn) => {
      try { fn({ remont: clone(snapshot.items) }); } catch {}
    });
    try { if (typeof global.sashaRemontReload === "function") global.sashaRemontReload(); } catch {}
  }

  function withCacheBust(url) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
  }

  async function loadConfig() {
    storeUrl = GIST_RAW;
    writeUrl = DEFAULT_WRITES[0];
    try {
      const res = await fetch(withCacheBust(CONFIG_URL), { cache: "no-store" });
      if (!res.ok) return;
      const cfg = await res.json();
      if (cfg && cfg.remontWrite) writeUrl = String(cfg.remontWrite);
      else writeUrl = DEFAULT_WRITES[0];
      if (cfg && cfg.remontRaw) storeUrl = String(cfg.remontRaw);
      else if (cfg && cfg.raw) storeUrl = String(cfg.raw).replace(/family-cloud\.json$/, FILE);
    } catch {}
  }

  async function readUrl(url) {
    const res = await fetch(withCacheBust(url), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("cloud-get " + res.status);
    const data = JSON.parse(await res.text());
    if (!data || typeof data !== "object") throw new Error("bad-cloud");
    return { items: asItems(data), rev: Number(data.rev || 0) };
  }

  function writeTargets() {
    const urls = [];
    if (writeUrl) urls.push(writeUrl);
    DEFAULT_WRITES.forEach((url) => {
      if (url && urls.indexOf(url) < 0) urls.push(url);
    });
    return urls;
  }

  async function remoteGet() {
    const urls = writeTargets().concat([storeUrl, PAGES_RAW]);
    const seen = {};
    for (const url of urls) {
      if (!url || seen[url]) continue;
      seen[url] = true;
      try {
        return await readUrl(url);
      } catch {}
    }
    return empty();
  }

  function writeMethods(url) {
    if (/jsonblob\.io|getpantry\.cloud/.test(url)) return ["POST", "PUT"];
    return ["PUT", "POST"];
  }

  async function remotePut(state) {
    const encoded = JSON.stringify(state);
    let last = "cloud-put no-store";
    for (const url of writeTargets()) {
      for (const method of writeMethods(url)) {
        try {
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: encoded,
          });
          if (res.ok) {
            writeUrl = url;
            return true;
          }
          last = "cloud-put " + res.status;
        } catch (err) {
          last = String(err?.message || err || "cloud-put");
        }
      }
    }
    throw new Error(last);
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
    let local = mergeState({ items: asItems(readJson(REMONT_KEY, [])), rev: 0 }, readJson(LOCAL_CLOUD, empty()));
    if (localExtra) local = mergeState(local, localExtra);
    persistLocal(local);

    await loadConfig();

    let remote = empty();
    try { remote = await remoteGet() || empty(); } catch { remote = empty(); }

    let merged = mergeState(remote, local);
    persistLocal(merged);
    if (core(merged) === core(remote) && remote.items && remote.items.length) {
      setStatus(!!writeUrl, writeUrl ? "" : "cloud-put no-store");
      return snapshot;
    }
    if (!writeUrl) {
      setStatus(false, "cloud-put no-store");
      return snapshot;
    }
    merged.rev = Number(merged.rev || 0) + 1;
    persistLocal(merged);
    try {
      await remotePut(merged);
      setStatus(true, "");
      const check = await remoteGet();
      const again = mergeState(check, merged);
      if (core(again) !== core(merged)) {
        again.rev = Number(again.rev || 0) + 1;
        persistLocal(again);
        await remotePut(again);
      }
    } catch (err) {
      setStatus(false, String(err?.message || err || "cloud-put"));
    }
    return snapshot;
  }

  function start() {
    if (started) return;
    started = true;
    snapshot = mergeState({ items: asItems(readJson(REMONT_KEY, [])), rev: 0 }, readJson(LOCAL_CLOUD, empty()));
    persistLocal(snapshot);
    enqueue(async () => {
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
    }, 5000);
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
    status() { return { ...cloudStatus }; },
    subscribe(fn) { if (typeof fn === "function") listeners.push(fn); },
    setRemont(list) {
      return applyPatch((s) => { s.items = mergeItems(s.items, list); });
    },
  };

  snapshot = mergeState({ items: asItems(readJson(REMONT_KEY, [])), rev: 0 }, readJson(LOCAL_CLOUD, empty()));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
