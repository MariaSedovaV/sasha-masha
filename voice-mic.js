(function (global) {
  const STORE = "sasha-mic-granted";
  let pending = null;
  let granted = false;
  try { granted = localStorage.getItem(STORE) === "1"; } catch {}

  function mark(on) {
    granted = Boolean(on);
    try {
      if (on) localStorage.setItem(STORE, "1");
      else localStorage.removeItem(STORE);
    } catch {}
  }

  function watchPermission() {
    const query = global.navigator?.permissions?.query;
    if (!query) return;
    Promise.resolve(query.call(global.navigator.permissions, { name: "microphone" })).then((status) => {
      if (!status) return;
      if (status.state === "granted") mark(true);
      if (status.state === "denied") mark(false);
      status.onchange = () => {
        if (status.state === "granted") mark(true);
        if (status.state === "denied") mark(false);
      };
    }).catch(() => {});
  }

  function unlock() {
    const media = global.navigator?.mediaDevices;
    if (!media?.getUserMedia) return Promise.resolve(granted);
    if (pending) return pending;
    watchPermission();
    pending = media.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    }).then((stream) => {
      try { stream.getTracks().forEach((track) => track.stop()); } catch {}
      mark(true);
      return true;
    }).catch((err) => {
      const name = String(err?.name || err?.message || "");
      if (/notallowed|notallowederror|permission/i.test(name)) mark(false);
      throw err;
    }).finally(() => { pending = null; });
    return pending;
  }

  watchPermission();
  global.SashaMic = {
    unlock,
    granted() { return granted; },
    forget() { mark(false); },
  };
})(window);
