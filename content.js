(() => {
  "use strict";

  const ATTR = "data-axbg";
  const CLEAR_ATTR = "data-axbg-clear";
  const STYLE_ID = "axbg-style";

  let settings = { ...AXBG_DEFAULTS };
  let panel = null;
  let scheduled = false;

  // ---------- поиск панели ----------

  function isFloating(el) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "absolute") return false;
    const r = el.getBoundingClientRect();
    return r.width > 200 && r.height > 120;
  }

  function findBySelector() {
    if (!settings.selector) return null;
    try { return document.querySelector(settings.selector); } catch { return null; }
  }

  // Ищем текст "Instant Trade" и поднимаемся до плавающего окна
  function findByHeading() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/instant\s*trade/i.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)
    });
    let node;
    while ((node = walker.nextNode())) {
      let el = node.parentElement;
      for (let depth = 0; el && el !== document.body && depth < 15; depth++) {
        if (isFloating(el)) return el;
        el = el.parentElement;
      }
    }
    return null;
  }

  function findPanel() {
    // у Axiom панель имеет стабильный id="instant-trade"
    return findBySelector() || document.getElementById("instant-trade") || findByHeading();
  }

  // ---------- применение стиля ----------

  function backgroundCss() {
    const s = settings;
    if (s.mode === "color") return s.color;
    if (s.mode === "gradient") return `linear-gradient(${s.gradAngle}deg, ${s.grad1}, ${s.grad2})`;
    const src = s.imageData || s.imageUrl;
    if (!src) return "transparent";
    const url = `url("${src.replace(/"/g, '\\"')}")`;
    if (s.imageFit === "tile") return `${url} ${s.imagePos} / auto repeat`;
    return `${url} ${s.imagePos} / ${s.imageFit} no-repeat`;
  }

  function buildCss(radius) {
    const b = Math.max(0, Number(settings.blur) || 0);
    const pad = b * 2; // фон чуть больше панели, чтобы блюр не оставлял светлых краёв
    return `
[${ATTR}] {
  isolation: isolate !important;
  background: transparent !important;
  background-color: transparent !important;
}
[${ATTR}]::before {
  content: "";
  position: absolute;
  inset: -${pad}px;
  z-index: -1;
  pointer-events: none;
  background: ${backgroundCss()};
  opacity: ${(Number(settings.opacity) || 0) / 100};
  filter: ${b ? `blur(${b}px)` : "none"};
  clip-path: inset(${pad}px round ${radius});
}
[${ATTR}]::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  border-radius: ${radius};
  background: rgba(0, 0, 0, ${(Number(settings.dim) || 0) / 100});
}
[${CLEAR_ATTR}] {
  background: transparent !important;
  background-color: transparent !important;
}`;
  }

  function setStyle(css) {
    let st = document.getElementById(STYLE_ID);
    if (!css) { st?.remove(); return; }
    if (!st) {
      st = document.createElement("style");
      st.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(st);
    }
    if (st.textContent !== css) st.textContent = css;
  }

  function untag(el) {
    if (!el) return;
    el.removeAttribute(ATTR);
    if (el.dataset.axbgPos) { el.style.position = ""; delete el.dataset.axbgPos; }
    el.querySelectorAll(`[${CLEAR_ATTR}]`).forEach((c) => c.removeAttribute(CLEAR_ATTR));
  }

  function tag(el) {
    // запоминаем исходный цвет фона панели ДО того, как наш стиль его уберёт
    if (!el.dataset.axbgOrig) el.dataset.axbgOrig = getComputedStyle(el).backgroundColor;
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
      el.dataset.axbgPos = "1";
    }
    el.setAttribute(ATTR, "");
  }

  // Делаем прозрачными только те внутренние блоки, у которых фон совпадает с фоном панели
  // (кнопки, поля ввода и выпадашки со своим цветом не трогаем)
  function updateInner() {
    if (!panel) return;
    const orig = panel.dataset.axbgOrig;
    const skip = "button, input, textarea, select, [role='button'], [role='menu'], [role='listbox']";
    panel.querySelectorAll("*").forEach((el) => {
      if (!settings.clearInner || el.closest(skip)) { el.removeAttribute(CLEAR_ATTR); return; }
      if (el.hasAttribute(CLEAR_ATTR)) return;
      const bg = getComputedStyle(el).backgroundColor;
      if (bg === orig && bg !== "rgba(0, 0, 0, 0)") el.setAttribute(CLEAR_ATTR, "");
    });
  }

  function apply() {
    scheduled = false;
    if (!settings.enabled) {
      untag(panel);
      panel = null;
      setStyle("");
      return;
    }
    const found = panel && panel.isConnected && (!settings.selector || panel.matches(settings.selector))
      ? panel
      : findPanel();
    if (found !== panel) { untag(panel); panel = found; }
    if (!panel) { setStyle(""); return; }
    tag(panel);
    const radius = getComputedStyle(panel).borderRadius || "0px";
    setStyle(buildCss(radius));
    updateInner();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(apply, 250);
  }

  // ---------- выбор панели кликом ----------

  function uniqueSelector(el) {
    if (el.id) return "#" + CSS.escape(el.id);
    const cls = [...el.classList].map((c) => "." + CSS.escape(c)).join("");
    if (cls) {
      const sel = el.tagName.toLowerCase() + cls;
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch {}
    }
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body) {
      if (cur.id) { parts.unshift("#" + CSS.escape(cur.id)); break; }
      const tagName = cur.tagName.toLowerCase();
      const idx = [...cur.parentElement.children].filter((c) => c.tagName === cur.tagName).indexOf(cur) + 1;
      parts.unshift(`${tagName}:nth-of-type(${idx})`);
      cur = cur.parentElement;
    }
    if (parts[0] && !parts[0].startsWith("#")) parts.unshift("body");
    return parts.join(" > ");
  }

  function startPicker() {
    if (document.getElementById("axbg-picker-box")) return;
    const box = document.createElement("div");
    box.id = "axbg-picker-box";
    box.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #a78bfa;" +
      "background:rgba(167,139,250,.15);border-radius:6px;transition:all .05s;";
    const hint = document.createElement("div");
    hint.style.cssText = "position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);" +
      "background:#1e1b2e;color:#fff;font:13px system-ui,sans-serif;padding:8px 14px;border-radius:8px;" +
      "box-shadow:0 4px 20px rgba(0,0,0,.5);pointer-events:none;";
    hint.textContent = "Клик — выбрать панель · ↑ — родительский блок · ↓ — обратно · Esc — отмена";
    document.documentElement.append(box, hint);

    let target = null;
    const history = [];

    const draw = () => {
      if (!target) return;
      const r = target.getBoundingClientRect();
      Object.assign(box.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    };
    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== box && el !== hint) { target = el; history.length = 0; draw(); }
    };
    const stop = () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      box.remove(); hint.remove();
    };
    const onClick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!target) return;
      const sel = uniqueSelector(target);
      stop();
      chrome.storage.local.set({ selector: sel });
    };
    const onKey = (e) => {
      if (e.key === "Escape") { stop(); }
      else if (e.key === "ArrowUp" && target?.parentElement && target.parentElement !== document.body) {
        history.push(target); target = target.parentElement; draw();
      } else if (e.key === "ArrowDown" && history.length) { target = history.pop(); draw(); }
      else return;
      e.preventDefault(); e.stopPropagation();
    };
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  }

  // ---------- связь с попапом и хранилищем ----------

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === "axbg-pick") { startPicker(); reply({ ok: true }); }
    else if (msg?.type === "axbg-status") {
      apply();
      reply({ found: !!panel, manual: !!settings.selector });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue ?? AXBG_DEFAULTS[k];
    apply();
  });

  chrome.storage.local.get(AXBG_DEFAULTS, (stored) => {
    settings = { ...AXBG_DEFAULTS, ...stored };
    apply();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  });
})();
