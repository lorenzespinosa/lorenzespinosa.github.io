(function () {
  "use strict";

  const root = document.documentElement;
  const desktop = window.matchMedia && matchMedia("(min-width: 768px)");
  // crew sizes for the card's shapes (styles/home.css)
  const fullCard = window.matchMedia && matchMedia("(min-width:105em) and (min-height:43.8125em)");
  const tileCard = window.matchMedia && matchMedia("(min-width:68.8125em) and (max-width:1208.98px) and (min-height:43.8125em) and (max-height:53.125em)");
  const crewFor = () => fullCard.matches ? 20 : tileCard.matches ? 4 : 8;
  const fineInput = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)");
  const agents = [];
  const sections = [];
  const pendingSections = [];
  const colours = [
    "#D63A00", "#9449EF", "#077CAA", "#018552", "#CD4438", "#906F05", "#8934EE",
    "#D4316C", "#068544", "#0077C9", "#B15E03", "#097F91",
  ];
  const arrow = "M6.24 3.82L23.17 10.13A1.5 1.5 0 0 1 22.98 13L16.28 14.53A1.5 1.5 0 0 0 15.18 15.56L13 22.8A1.5 1.5 0 0 1 10.14 22.84L4.42 5.57A1.4 1.4 0 0 1 6.24 3.82Z";
  const shapes = {
    arrow: { hot: [3.5, 2.8], fill: arrow },
    dup: { hot: [3.5, 2.8], fill: arrow, badge: true },
    ibeam: { hot: [14, 14], line: "M10.5 5.5H17.5M14 5.5V22.5M10.5 22.5H17.5" },
    cross: { hot: [14, 14], line: "M14 5V11M14 17V23M5 14H11M17 14H23" },
    ew: { hot: [14, 14], line: "M5.5 14H22.5M9 10.5L5.5 14L9 17.5M19 10.5L22.5 14L19 17.5" },
    ns: { hot: [14, 14], line: "M14 5.5V22.5M10.5 9L14 5.5L17.5 9M10.5 19L14 22.5L17.5 19" },
  };

  let layer, card, cardStatus, cardGrid, gridRect, rulers, observer, tidyBatch;
  let enabled = false, failed = false, pageAway = false, building = false;
  let constructionActive = false, awaitingOpeningSections = false;
  let needsBuildFrame = false, scrollSettled = true;
  let frame = 0, lastFrame = 0, prepareTimer = 0, restTimer = 0, rulerTimer = 0;
  let crewSize = fullCard ? crewFor() : 8;
  let I = root.clientWidth || innerWidth, V = innerHeight;
  let D = 0, $ = 0, S = 0, M = 0, k = 2.1, Q = null;
  const d = 20;

  window.wvSwarm = {
    get time() {
      return M;
    },
    tidy,
    settleTidy,
    status,
  };

  function status() {
    if (!enabled) return { total: 0, working: 0, resting: 0, mode: "off" };
    const total = agents.length;
    const working = agents.filter(agent => agent.job).length;
    const mode = working ? "building" : agents.every(agent => agent.parked) ? "resting" : "returning";
    return { total, working, resting: total - working, mode };
  }

  function updateRestCard() {
    if (!enabled) return;
    const { total, working, resting } = status();
    const line = !working
      ? "All " + total + " agents resting"
      : !resting
        ? "All " + total + " agents working"
        : working + (working === 1 ? " agent" : " agents") + " working · " + resting + " resting";
    if (line !== cardStatus.textContent) cardStatus.textContent = line;
  }

  function tidy(items, done) {
    if (!enabled || !items || !items.length) return false;
    settleTidy();
    if (!enabled || tidyBatch) return false;
    tidyBatch = {
      items: items.map(item => ({ kind: "tidy", item, worker: null, done: false })),
      remaining: items.length,
      done,
    };
    wake();
    return true;
  }

  function dropTidyItem(job) {
    try {
      job.item.drop();
    } catch (_) {}
  }

  function notifyTidyDone(batch) {
    try {
      if (batch.done) batch.done();
    } catch (_) {}
  }

  function finishTidyItem(job) {
    if (job.done) return;
    const batch = tidyBatch;
    job.done = true;
    releaseTidyWorker(job);
    if (--batch.remaining === 0) tidyBatch = null;
    dropTidyItem(job);
    if (!batch.remaining) notifyTidyDone(batch);
  }

  function releaseTidyWorker(job) {
    if (!job.worker) return;
    const agent = job.worker;
    job.worker = null;
    releaseAgent(agent);
  }

  function settleTidy() {
    if (!tidyBatch) return;
    const batch = tidyBatch;
    tidyBatch = null;
    const unfinished = batch.items.filter(job => !job.done);
    for (const job of unfinished) {
      job.done = true;
      releaseTidyWorker(job);
    }
    unfinished.forEach(dropTidyItem);
    notifyTidyDone(batch);
  }

  function startTidyJobs(freeAgents) {
    if (!tidyBatch) return;
    for (const job of tidyBatch.items) {
      if (!freeAgents.length) break;
      if (job.worker || job.done) continue;
      const agent = freeAgents.shift();
      const item = job.item;
      job.worker = agent;
      claimAgent(agent, job, "tidy");
      let origin;
      job.steps = [
        de(() => item.from(), 1),
        ue(agent => {
          agent.press = 1;
          origin = { x: agent.x, y: agent.y };
          item.start();
        }),
        se(0.08),
        de(() => item.to(), 0.55, {
          drag: true,
          frame(agent) {
            agent.press = 1;
            item.move(agent.x - origin.x, agent.y - origin.y);
          },
        }),
      ];
    }
  }

  function at(t, e, n) {
    return Math.max(e, Math.min(t, n));
  }
  function lt(t, e) {
    return t + Math.random() * (e - t);
  }
  function readScroll() {
    D = window.scrollX || 0;
    $ = window.scrollY || 0;
  }
  function wt(t) {
    return t.complete || t.landed;
  }
  function bt(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2;
  }
  function Mt(t) {
    return t < 0.15 ? bt(t) : ((e = t), 1 - Math.pow(1 - e, 3));
    var e;
  }
  function Et(t, e) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", t);
    for (var o in e) n.setAttribute(o, e[o]);
    return n;
  }

  function createCrew() {
    layer = document.createElement("span");
    layer.className = "wv-crew-layer";
    layer.setAttribute("aria-hidden", "true");
    card = document.createElement("span");
    card.className = "wv-rest-card";
    card.setAttribute("aria-hidden", "true");
    cardStatus = document.createElement("span");
    cardGrid = document.createElement("span");
    cardGrid.className = "wv-rest-grid";
    card.append(cardStatus, cardGrid);
    layer.appendChild(card);
    document.body.appendChild(layer);
    syncCrewSize();
    dispatchEvent(new Event("wv-card"));
    // the card's shape can change without a resize (text size)
    if (window.ResizeObserver) new ResizeObserver(() => enabled && crewSize !== crewFor() && (syncCrewSize(), dispatchEvent(new Event("wv-card")))).observe(card);
  }

  function createAgent(number) {
    const node = document.createElement("span");
    node.className = "wv-worker";
    node.dataset.worker = String(number);
    node.dataset.shape = "arrow";
    const colour = colours[(number - 1) % colours.length];
    node.style.setProperty("--wv-worker-colour", colour);

    const graphic = Et("svg", { viewBox: "0 0 28 28", width: "28", height: "28", focusable: "false" });
    for (const [shape, design] of Object.entries(shapes)) {
      const group = Et("g", { class: "wv-g wv-g-" + shape });
      if (design.fill) group.appendChild(Et("path", { d: design.fill, class: "wv-g-fill" }));
      if (design.line) {
        group.appendChild(Et("path", { d: design.line, class: "wv-g-halo" }));
        group.appendChild(Et("path", { d: design.line, class: "wv-g-line" }));
      }
      if (design.badge) {
        group.appendChild(Et("circle", { cx: "22.5", cy: "22.5", r: "3.8", class: "wv-g-fill" }));
        group.appendChild(Et("path", { d: "M22.5 20.3V24.7M20.3 22.5H24.7", class: "wv-g-mark" }));
      }
      graphic.appendChild(group);
    }
    const tag = document.createElement("span");
    tag.className = "wv-agent-tag";
    tag.textContent = "Agent " + number;
    node.append(graphic, tag);
    return {
      number, node, graphic, job: null, grip: null, path: null, parked: false,
      shape: "arrow", x: 0, y: 0, press: 0, drawn: "", scale: "",
    };
  }

  // two rows in the corner card
  function slot(agent) {
    const columns = crewSize / 2;
    const index = (agent.number - 1) % crewSize;
    return { x: (index % columns + 0.5) / columns, y: index < columns ? 0.25 : 0.75 };
  }

  function home(agent) {
    const point = slot(agent);
    return {
      x: D + gridRect.left + gridRect.width * point.x - 7,
      y: $ + gridRect.top + gridRect.height * point.y - 7,
    };
  }

  function parkAgent(agent) {
    const point = slot(agent);
    agent.parked = true;
    agent.drawn = "";
    agent.scale = "";
    agent.node.style.transform = "";
    agent.graphic.style.transform = "";
    agent.node.style.setProperty("--wv-slot-x", (100 * point.x) + "%");
    agent.node.style.setProperty("--wv-slot-y", (100 * point.y) + "%");
    agent.node.dataset.work = "parked";
    cardGrid.appendChild(agent.node);
  }

  function removeAgent(agent) {
    agents.splice(agents.indexOf(agent), 1);
    agent.node.remove();
  }

  function syncCrewSize() {
    crewSize = crewFor();
    if (constructionActive && crewSize < 20) releaseHeld();
    gridRect = null;
    for (const agent of agents.slice()) {
      if (agent.number > crewSize) {
        const job = agent.job;
        if (job && job.kind === "tidy") finishTidyItem(job);
        else if (job && job.worker === agent) finishBuildTask(job);
        else if (job) job.helpers = job.helpers.filter(helper => helper !== agent);
        removeAgent(agent);
      } else if (agent.parked) parkAgent(agent);
    }
    for (let number = 1; number <= crewSize; number++) {
      if (agents.some(agent => agent.number === number)) continue;
      const agent = createAgent(number);
      agents.push(agent);
      parkAgent(agent);
    }
    agents.sort((first, second) => first.number - second.number);
    updateRestCard();
  }

  // a card turned smaller during the opening: what smaller crews leave unbuilt shows now and stays
  function releaseHeld() {
    for (const section of sections) {
      const held = heldIn(section.host), isHeld = el => held.some(c => c.contains(el));
      if (section.done) continue;
      section.tasks.filter(job => job.el && isHeld(job.el)).forEach(finishBuildTask);
      section.pieces.filter(isHeld).forEach(piece => piece.removeAttribute("data-wv-hide"));
      section.pieces = section.pieces.filter(piece => !isHeld(piece));
    }
  }

  function freeAgents() {
    const capacity = crewSize - agents.filter(agent => agent.job).length;
    return agents.filter(agent => agent.parked && agent.number <= crewSize).slice(0, Math.max(0, capacity));
  }

  function claimAgent(agent, job, work) {
    const origin = home(agent);
    agent.job = job;
    agent.parked = false;
    agent.x = origin.x;
    agent.y = origin.y;
    agent.node.dataset.work = work;
    drawAgent(agent);
    layer.appendChild(agent.node);
    updateRestCard();
  }

  function releaseAgent(agent) {
    agent.job = null;
    agent.grip = null;
    agent.press = 0;
    agent.path = null;
    setAgentShape(agent, "arrow");
    agent.node.dataset.work = "returning";
    updateRestCard();
    wake();
  }

  function setAgentShape(agent, shape) {
    if (agent.shape === shape) return;
    agent.shape = shape;
    agent.node.dataset.shape = shape;
  }

  function drawAgent(agent) {
    const [hotX, hotY] = shapes[agent.shape].hot;
    const left = (agent.x - D - hotX).toFixed(1);
    const top = (agent.y - $ - hotY).toFixed(1);
    const position = "translate3d(" + left + "px," + top + "px,0)";
    const scale = agent.press > 0 ? "scale(" + (1 - 0.12 * agent.press).toFixed(3) + ")" : "";
    if (position !== agent.drawn) agent.node.style.transform = agent.drawn = position;
    agent.node.classList.toggle("wv-fx", left > I - 112);
    agent.node.classList.toggle("wv-fy", top > V - 46);
    agent.node.classList.toggle("wv-out", left > I - 10 || top > V - 10 || left < -16 || top < -16);
    if (scale !== agent.scale) agent.graphic.style.transform = agent.scale = scale;
  }
  function zt(t, e, n) {
    var o = e(),
      r = Math.hypot(o.x - t.x, o.y - t.y);
    if (r < 0.5) return ((t.path = null), (t.x = o.x), void (t.y = o.y));
    t.path = {
      fx: t.x,
      fy: t.y,
      target: e,
      t: 0,
      dur: at(0.12 + 0.021 * Math.sqrt(r), 0.14, 0.9) / n,
      bend: (Math.random() < 0.5 ? -1 : 1) * lt(0.04, 0.14) * Math.min(r, 600),
    };
  }
  function Ht(t, e) {
    var n = t.path;
    if (!n) return !0;
    n.t += e * k;
    var o = Math.min(1, n.t / n.dur),
      r = n.drag ? bt(o) : Mt(o),
      i = n.target(),
      a = i.x - n.fx,
      l = i.y - n.fy,
      c = Math.hypot(a, l) || 1,
      s = Math.sin(Math.PI * r) * n.bend;
    return (
      (t.x = n.fx + a * r - (l / c) * s),
      (t.y = n.fy + l * r + (a / c) * s),
      !(o < 1) && ((t.path = null), !0)
    );
  }
  function Xt(t, e, n, o) {
    try {
      t.anims.push(e.animate(n, o));
    } catch (t) {}
  }
  function Wt(t) {
    t.setAttribute("data-wv-hide", "1");
  }
  function Yt(t) {
    "1" === t.getAttribute("data-wv-hide") && t.setAttribute("data-wv-hide", "0");
  }
  function Ot(t) {
    for (var e = t.firstChild; e; e = e.nextSibling) if (3 === e.nodeType && e.nodeValue.trim()) return !0;
    return !1;
  }
  // smaller crews, and a full one once the card was smaller at the start, leave out the hero's headline and lede and what
  // holds a button (styles/home.css)
  function heldIn(t) {
    return fullCard.matches && !root.classList.contains("wv-held") ? [] : [].filter.call(t.children, c => t.matches(".lead-head") || c.matches(".btn") || c.querySelector(".btn"));
  }
  function qt(t) {
    var held = heldIn(t);
    var free = function (el) { return !held.some(function (c) { return c.contains(el); }); };
    var e = [].slice.call(t.querySelectorAll("[data-build-op]")).filter(free);
    for (var n = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), o = n.nextNode(); o; o = n.nextNode()) {
      var r = o.parentElement;
      if (r && o.nodeValue.trim() && free(r) && !r.closest("script,style,svg,template"))
        if (
          (!r.closest("details:not([open])") || r.closest("summary")) &&
          !r.closest('[data-build-op="carry"]')
        ) {
          for (
            ;
            r !== t &&
            e.indexOf(r) < 0 &&
            r.parentElement !== t &&
            "inline" === getComputedStyle(r).display &&
            Ot(r.parentElement);
          )
            r = r.parentElement;
          r === t ||
            e.indexOf(r) >= 0 ||
            e.some(function (t) {
              return t.contains(r) && "type" === It(t);
            }) ||
            e.push(r);
        }
    }
    return e;
  }
  function It(t) {
    var e = t.dataset.buildOp;
    return "place" === e && t.hasAttribute("data-build-whole")
      ? "place"
      : e && "place" !== e && "draw" !== e
        ? e
        : Ot(t) && !t.querySelector("svg,img,input,button,select,textarea,video,canvas")
          ? "type"
          : e || "place";
  }
  function finishBuildTask(job) {
    if (job.complete) return;
    job.complete = true;
    releaseBuildWorkers(job);
    for (const animation of job.anims) {
      try {
        animation.cancel();
      } catch (_) {}
    }
    job.anims = [];
    if (job.hands) {
      const hands = job.hands;
      hands.image.removeEventListener("error", hands.failed);
      for (const clone of hands.clones) clone.removeEventListener("error", hands.failed);
      hands.image.style.opacity = hands.opacity;
      job.el.classList.remove("wv-hands-active");
      if (hands.layer) hands.layer.remove();
      job.hands = null;
    }
    if (job.outline) job.outline.remove();
    if (job.typing) job.typing.remove();
    if (job.el) {
      job.el.classList.remove("wv-text-wait");
      Yt(job.el);
    }
    if (job.op === "carry") landCarry(job);
  }
  function landCarry(job) {
    if (job.landedBox) return;
    job.landedBox = true;
    job.el.style.transform = "";
    try {
      job.el.dispatchEvent(new CustomEvent("wv-landed", { bubbles: true }));
    } catch (_) {}
  }
  function finishSection(section) {
    if (section.done) return;
    section.done = true;
    section.host.dataset.wvBuild = "complete";
    if (observer) observer.unobserve(section.host);
    section.tasks.forEach(finishBuildTask);
    for (const piece of section.pieces) {
      const pendingCarry = piece.dataset.buildOp === "carry" && piece.getAttribute("data-wv-hide") === "1";
      piece.removeAttribute("data-wv-hide");
      if (pendingCarry) landCarry({ el: piece });
    }
    if (section.overlay) section.overlay.remove();
    dispatchEvent(new Event("wv-card"));
    if (constructionActive && sections.every(entry => entry.done)) finishConstruction();
  }

  function $t(t) {
    var e = String(t.className || "")
      .split(/\s+/)
      .filter(Boolean);
    return (
      t.tagName +
      "." +
      e
        .filter(function (t) {
          return !e.some(function (e) {
            return e !== t && 0 === t.indexOf(e) && /^\d+$/.test(t.slice(e.length));
          });
        })
        .sort()
        .join(".")
    );
  }
  function _t(t) {
    if (Q && Q.has(t)) return Q.get(t);
    var e = (function (t) {
      var e = getComputedStyle(t),
        n = ["Top", "Right", "Bottom", "Left"].map(function (t) {
          return (
            e["border" + t + "Width"] + " " + e["border" + t + "Style"] + " " + e["border" + t + "Color"]
          );
        });
      return [$t(t), e.fontFamily, e.fontSize, e.fontWeight, e.color, e.backgroundColor, n.join("/")].join(
        "|",
      );
    })(t);
    return (Q && Q.set(t, e), e);
  }
  function Zt(t) {
    return [t]
      .concat([].slice.call(t.querySelectorAll("*")))
      .map(_t)
      .join("\n");
  }
  function Jt(t) {
    var e = It(t),
      n = getComputedStyle(t),
      o = {
        el: t,
        op: e,
        rect: t.getBoundingClientRect(),
        interactive: !(
          !t.matches("a,button,input,label,details,summary") && !t.querySelector("a,button,input,summary")
        ),
        look: Zt(t),
        font: null,
        text: null,
        image: null,
        imageRect: null,
        words: "",
        size: 16,
        lineHeight: 20,
        boxed:
          !/^(transparent|rgba\([^)]*,\s*0\))$/.test(n.backgroundColor) ||
          "none" !== n.backgroundImage ||
          ["Top", "Right", "Bottom", "Left"].some(function (t) {
            return parseFloat(n["border" + t + "Width"]) > 0 && "none" !== n["border" + t + "Style"];
          }),
      };
    if ("type" === e) {
      for (
        var r = document.createTreeWalker(t, NodeFilter.SHOW_TEXT),
          i = document.createRange(),
          a = null,
          l = null,
          c = r.nextNode();
        c;
        c = r.nextNode()
      )
        if (c.nodeValue.trim()) {
          i.selectNodeContents(c);
          var s = i.getBoundingClientRect();
          s.width &&
            s.height &&
            ((l = l || c.parentElement),
            (a = a
              ? {
                  left: Math.min(a.left, s.left),
                  top: Math.min(a.top, s.top),
                  right: Math.max(a.right, s.right),
                  bottom: Math.max(a.bottom, s.bottom),
                }
              : { left: s.left, top: s.top, right: s.right, bottom: s.bottom }));
        }
      var u = getComputedStyle(l || t);
      ((o.text = a || { left: o.rect.left, top: o.rect.top, right: o.rect.right, bottom: o.rect.bottom }),
        (o.font = {
          fontFamily: u.fontFamily,
          fontSize: u.fontSize,
          fontWeight: u.fontWeight,
          fontStyle: u.fontStyle,
          lineHeight: u.lineHeight,
          letterSpacing: u.letterSpacing,
          textTransform: u.textTransform,
          textAlign: n.textAlign,
          color: u.color,
        }),
        (o.size = parseFloat(u.fontSize) || 16),
        (o.lineHeight = parseFloat(u.lineHeight) || 1.2 * o.size),
        (o.words = t.dataset.typeText
          ? t.dataset.typeText.split("|").join("\n")
          : String(t.innerText || t.textContent)
              .replace(/[ \t]+/g, " ")
              .replace(/ ?\n ?/g, "\n")
              .replace(/\n{2,}/g, "\n")
              .trim()));
    } else if ("hands" === e) {
      var d = t.querySelector("img");
      d &&
        d.currentSrc &&
        (!d.complete || d.naturalWidth) &&
        ((o.image = d), (o.imageRect = d.getBoundingClientRect()));
    }
    return o;
  }
  function Kt(t, e) {
    var n = t.m,
      o = e / n.size,
      r = t.typing.style;
    ((t.size = e),
      (r.fontSize = e + "px"),
      (r.lineHeight = r.minHeight = n.lineHeight * o + "px"),
      /px$/.test(n.font.letterSpacing) && (r.letterSpacing = parseFloat(n.font.letterSpacing) * o + "px"));
  }
  function Qt(t) {
    t.typing && (t.typing.style.transform = "translate(" + t.ox.toFixed(1) + "px," + t.oy.toFixed(1) + "px)");
  }
  function Ut(t, e, n) {
    return {
      job: t,
      kind: "guide",
      op: "guide",
      horizontal: e,
      at: n,
      line: null,
      el: null,
      outline: null,
      typing: null,
      hands: null,
      anims: [],
      complete: !1,
      worker: null,
      steps: [],
      after: null,
      docLeft: e ? D : n,
      docTop: e ? n : t.docTop,
      width: e ? I : 1,
      height: e ? 1 : t.hostRect.height,
    };
  }
  function te(t) {
    if (!t.started && !t.done) {
      t.started = !0;
      try {
        var e;
        ((t.hostRect = t.host.getBoundingClientRect()),
          (t.inset = { left: t.host.clientLeft, top: t.host.clientTop }),
          (t.docLeft = t.hostRect.left + D + t.inset.left),
          (t.docTop = t.hostRect.top + $ + t.inset.top),
          (Q = "function" == typeof Map ? new Map() : null));
        try {
          e = t.pieces.map(Jt);
        } finally {
          Q = null;
        }
        ((t.host.dataset.wvBuild = "building"),
          (t.overlay = document.createElement("span")),
          (t.overlay.className = "wv-job-overlay"),
          t.overlay.setAttribute("aria-hidden", "true"),
          t.host.appendChild(t.overlay));
        var n = [];
        e.forEach(function (e) {
          var o = (function (t, e) {
            var n = e.rect,
              o = t.hostRect,
              r = t.inset;
            if (!n.width || !n.height) return null;
            var i = n.left - o.left - r.left,
              a = n.top - o.top - r.top,
              l = document.createElement("span"),
              c = document.createElement("span");
            ((l.className = "wv-task-guide"),
              l.setAttribute("aria-hidden", "true"),
              (l.dataset.op = e.op),
              (l.dataset.state = "waiting"),
              (l.style.left = i + "px"),
              (l.style.top = a + "px"),
              (c.className = "wv-dimension"),
              l.appendChild(c));
            var s = document.createElement("span"),
              u = document.createElement("span");
            ((s.className = "wv-measure wv-measure-x"),
              (u.className = "wv-measure wv-measure-y"),
              s.setAttribute("aria-hidden", "true"),
              u.setAttribute("aria-hidden", "true"),
              l.appendChild(s),
              l.appendChild(u),
              t.overlay.appendChild(l));
            var d = {
              job: t,
              kind: "part",
              el: e.el,
              op: e.op,
              m: e,
              outline: l,
              dimension: c,
              mx: s,
              my: u,
              label: "",
              shiftX: 0,
              shiftY: 0,
              typing: null,
              textNode: null,
              hands: null,
              anims: [],
              complete: !1,
              worker: null,
              steps: [],
              after: null,
              source: null,
              ox: 0,
              oy: 0,
              snap: "",
              grow: !1,
              size: 0,
              left: i,
              top: a,
              width: n.width,
              height: n.height,
              docLeft: n.left + D,
              docTop: n.top + $,
              text: "",
              typed: 0,
            };
            if ("type" === e.op) {
              var f = e.text,
                h = document.createElement("span"),
                p = document.createElement("span"),
                y = e.font;
              for (var x in ((h.className = "wv-typing"),
              h.setAttribute("aria-hidden", "true"),
              (d.tl = f.left - o.left - r.left),
              (d.tt = f.top - o.top - r.top),
              e.boxed || ((l.style.left = d.tl + "px"), (l.style.top = d.tt + "px")),
              (h.style.left = d.tl + "px"),
              (h.style.top = d.tt + "px"),
              (h.style.width = f.right - f.left + 2 + "px"),
              y))
                h.style[x] = y[x];
              ((p.className = "wv-typing-text"),
                h.appendChild(p),
                t.overlay.appendChild(h),
                (d.typing = h),
                (d.textNode = p),
                (d.text = e.words),
                (d.textLeft = f.left + D),
                (d.textTop = f.top + $),
                (d.textWidth = f.right - f.left),
                (d.textHeight = f.bottom - f.top),
                (d.grow = !e.boxed && e.size >= 30),
                Kt(d, d.grow ? 18 : e.size));
            }
            return d;
          })(t, e);
          o ? n.push(o) : Yt(e.el);
        });
        var o = function (e, n) {
            var r = e.parentNode,
              i = n.parentNode;
            return r === i || (!(!r || !i || r === t.host || i === t.host) && $t(r) === $t(i) && o(r, i));
          },
          r = function (t, e) {
            return (
              t.m.look === e.m.look && o(t.el, e.el) && !(t.el.parentNode && "P" === t.el.parentNode.tagName)
            );
          };
        n.forEach(function (t) {
          if (
            (n.forEach(function (e) {
              e === t || !e.el.contains(t.el) || (t.after && !t.after.el.contains(e.el)) || (t.after = e);
            }),
            "place" === t.op)
          ) {
            var e = n.filter(function (e) {
              return "place" === e.op && r(e, t);
            })[0];
            e !== t &&
              ((t.op = "dup"),
              (t.source = e),
              (t.after = e),
              (t.outline.dataset.op = "dup"),
              (t.outline.style.left = e.left + "px"),
              (t.outline.style.top = e.top + "px"));
          }
        });
        var i = function (t, e) {
          return n.filter(function (n) {
            return n.el !== t && t.contains(n.el) && (!e || n.op === e);
          });
        };
        n.forEach(function (t) {
          if ("dup" === t.op) {
            t.waitFor = [t.source].concat(i(t.source.el));
            var e = i(t.el, "type"),
              o = i(t.source.el, "type");
            ((t.edits = []),
              i(t.el).forEach(function (r) {
                var i = o[e.indexOf(r)];
                ("type" !== r.op || i) &&
                  ("type" === r.op && i.text !== r.text
                    ? ((r.op = "edit"),
                      (r.was = i.text),
                      (r.after = t),
                      t.edits.push(r),
                      (r.waitGroup = n.filter(function (e) {
                        return "dup" === e.op && e.source === t.source;
                      })))
                    : (r.carried = t));
              }));
          }
        });
        var a = n.filter(function (t) {
          return "type" === t.op && !t.carried && (t.m.boxed || t.textHeight <= 1.6 * t.m.lineHeight);
        });
        if (
          (a.forEach(function (t) {
            // Only identical text is copied; look-alikes are typed.
            var e = a.filter(function (e) {
                return r(e, t) && e.text === t.text;
              }),
              n = e[0];
            n &&
              n !== t &&
              ((t.textual = !0),
              (t.stage = "copy"),
              (t.source = n),
              (t.after = n),
              (t.was = n.text),
              (t.edits = []),
              (t.op = t.was !== t.text ? "edit" : "dup"),
              (t.waitFor = [n].concat(i(n.el))),
              (t.copies = e.slice(1)),
              (t.outline.dataset.op = "dup"),
              (t.outline.style.left = (t.m.boxed ? n.left : n.tl) + "px"),
              (t.outline.style.top = (t.m.boxed ? n.top : n.tt) + "px"));
          }),
          n.forEach(function (t) {
            if ("connect" === t.op) {
              var e = n.filter(function (e) {
                return (
                  ("place" === e.op || "dup" === e.op) &&
                  t.docLeft <= e.docLeft + e.width + 2 &&
                  e.docLeft <= t.docLeft + t.width + 2 &&
                  t.docTop <= e.docTop + e.height + 2 &&
                  e.docTop <= t.docTop + t.height + 2
                );
              });
              e.length && (t.waitFor = (t.waitFor || []).concat(e));
            }
          }),
          n.length)
        ) {
          var l = Math.min.apply(
              null,
              n.map(function (t) {
                return t.docTop;
              }),
            ),
            c = Math.min.apply(
              null,
              n.map(function (t) {
                return t.docLeft;
              }),
            );
          ((t.tasks = [Ut(t, !0, l), Ut(t, !1, c)].concat(n)),
            n.forEach(function (t) {
              "type" !== t.op ||
                t.m.boxed ||
                t.carried ||
                ((t.snap = Math.abs(t.docLeft - c) < 3 ? "x" : Math.abs(t.docTop - l) < 3 ? "y" : ""),
                t.snap &&
                  ((t.ox = "x" === t.snap ? lt(28, 64) : lt(-8, 8)),
                  (t.oy = "x" === t.snap ? lt(-8, 8) : lt(18, 34) * (Math.random() < 0.5 ? -1 : 1)),
                  Qt(t),
                  (t.outline.style.left = t.tl + t.ox + "px"),
                  (t.outline.style.top = t.tt + t.oy + "px")));
            }));
        }
        t.tasks.length || finishSection(t);
      } catch (e) {
        finishSection(t);
      }
      requestBuildFrame();
    }
  }

  function queueSection(section) {
    if (!constructionActive || section.started || section.done || pendingSections.includes(section)) return;
    pendingSections.push(section);
    if (!prepareTimer) prepareTimer = setTimeout(prepareNextSection, 0);
  }

  function prepareNextSection() {
    prepareTimer = 0;
    if (!enabled) return;
    readScroll();
    te(pendingSections.shift());
    if (pendingSections.length) prepareTimer = setTimeout(prepareNextSection, 0);
    finishOpeningIfIdle();
  }

  function oe(t) {
    return crewSize === 8 && t.docTop < $ ? Math.max(S, $ + 1.3 * V) : S;
  }
  function re(t) {
    return wt(t) || t.docTop > oe(t.job);
  }
  function ie(t) {
    return t.docTop < $ + V && t.docTop + t.height > $ ? 1 : 0;
  }
  function ae(t) {
    return "guide" === t.kind
      ? t.horizontal
        ? { x: D + t.fromX, y: $ + 10 }
        : { x: D + 10, y: $ + t.fromY }
      : "dup" === t.op
        ? t.grab || { x: t.source.docLeft + t.source.width / 2, y: t.source.docTop + t.source.height / 2 }
        : "connect" === t.op
          ? t.height > t.width
            ? { x: t.docLeft + t.width / 2, y: t.docTop }
            : { x: t.docLeft, y: t.docTop + t.height / 2 }
          : "type" !== t.op || t.m.boxed
            ? { x: t.docLeft, y: t.docTop }
            : { x: t.textLeft + t.ox, y: t.textTop + t.oy };
  }
  function le(t) {
    return "guide" === t.kind
      ? t.horizontal
        ? { x: D + t.fromX, y: t.at }
        : { x: t.at, y: $ + t.fromY }
      : t.textual && "copy" === t.stage
        ? t.m.boxed
          ? { x: t.grab.x + t.docLeft - t.source.docLeft, y: t.grab.y + t.docTop - t.source.docTop }
          : { x: t.grab.x + t.textLeft - t.source.textLeft, y: t.grab.y + t.textTop - t.source.textTop }
        : "dup" === t.op
          ? { x: t.grab.x + t.docLeft - t.source.docLeft, y: t.grab.y + t.docTop - t.source.docTop }
          : "connect" === t.op
            ? t.height > t.width
              ? { x: t.docLeft + t.width / 2, y: t.docTop + t.height }
              : { x: t.docLeft + t.width, y: t.docTop + t.height / 2 }
            : "type" !== t.op || t.m.boxed
              ? { x: t.docLeft + t.width, y: t.docTop + t.height }
              : {
                  x: t.textLeft + t.ox + t.textWidth,
                  y: t.textTop + t.oy + parseFloat(t.typing.style.lineHeight),
                };
  }
  function ce(t) {
    return "guide" === t.kind
      ? t.horizontal
        ? "ns"
        : "ew"
      : "type" === t.op
        ? "ibeam"
        : "dup" === t.op || "hands" === t.op
          ? "dup"
          : "connect" === t.op
            ? t.height > t.width
              ? "ns"
              : "ew"
            : "cross";
  }
  function se(t) {
    var e = t;
    return function (t, n) {
      return (e -= n * k) <= 0;
    };
  }
  function ue(t) {
    return function (e) {
      return (t(e), !0);
    };
  }
  function de(t, e, n) {
    var o = !1;
    return (
      (n = n || {}),
      function (r, i) {
        if (!o && ((o = !0), zt(r, t, e), r.path && ((r.path.drag = !!n.drag), null != n.bend))) {
          var a = t();
          r.path.bend =
            n.bend * (Math.random() < 0.5 ? -1 : 1) * Math.min(Math.hypot(a.x - r.x, a.y - r.y), 600);
        }
        var l = Ht(r, i);
        return (n.frame && n.frame(r), l);
      }
    );
  }
  function fe(t) {
    var e = 0;
    return function (n, o) {
      if ((e -= o) > 0) return !1;
      if (t.typed >= t.text.length) return !0;
      var r = t.text.charAt(t.typed);
      return (
        (t.typed = Math.min(t.text.length, t.typed + Math.max(1, Math.round(t.text.length / 70)))),
        (t.textNode.textContent = t.text.slice(0, t.typed)),
        (e =
          (lt(12, 40) +
            (" " === r ? lt(0, 30) : 0) +
            ("\n" === r ? 100 : 0) +
            (Math.random() < 0.025 ? lt(80, 200) : 0)) /
          1e3 /
          k),
        !1
      );
    };
  }
  function he(t, e, n) {
    var o = Math.round(e) + " × " + Math.round(n);
    (o !== t.label && ((t.label = o), (t.dimension.textContent = o)),
      (t.dimension.style.transform =
        "translate(" + (e / 2).toFixed(1) + "px," + (n + 4).toFixed(1) + "px) translateX(-50%)"),
      t.outline.style.setProperty("--wv-w", e.toFixed(1) + "px"),
      t.outline.style.setProperty("--wv-h", n.toFixed(1) + "px"));
  }
  function pe(t) {
    return function (e) {
      var n = Math.max(0, e.x - t.a.x),
        o = Math.max(0, e.y - t.a.y);
      ((t.outline.style.width = n + "px"), (t.outline.style.height = o + "px"), he(t, n, o));
    };
  }
  function ye(t) {
    var e = document.createElement("span");
    ((e.className = "wv-guide " + (t.horizontal ? "wv-guide-h" : "wv-guide-v")),
      e.setAttribute("aria-hidden", "true"),
      t.horizontal && ((e.style.left = D - t.job.docLeft + "px"), (e.style.width = I + "px")),
      t.job.overlay.appendChild(e),
      (t.line = e));
  }
  function xe(t, e) {
    t.line.style.transform = t.horizontal
      ? "translateY(" + (e.y - t.job.docTop).toFixed(1) + "px)"
      : "translateX(" + (e.x - t.job.docLeft).toFixed(1) + "px)";
  }
  function me(t, e) {
    ((t.shiftX = e.x - t.grab.x),
      (t.shiftY = e.y - t.grab.y),
      (t.outline.style.transform = "translate(" + t.shiftX.toFixed(1) + "px," + t.shiftY.toFixed(1) + "px)"));
  }
  function ve(t) {
    var e = t.outline;
    if (e && t.mx && "active" === e.dataset.state) {
      var n = parseFloat(e.style.width) || 0,
        o = parseFloat(e.style.height) || 0,
        r = Math.max(0, t.job.docLeft + (parseFloat(e.style.left) || 0) + t.shiftX - D - d),
        i = Math.max(0, t.job.docTop + (parseFloat(e.style.top) || 0) + t.shiftY - $ - d),
        a = t.job.docLeft + (parseFloat(e.style.left) || 0) + t.shiftX - D,
        l = t.job.docTop + (parseFloat(e.style.top) || 0) + t.shiftY - $,
        c = at(o / 2, Math.min(o, 23 - l), o),
        s = at(n / 2, Math.min(n, 23 - a), n),
        u =
          Math.round(r) +
          "," +
          Math.round(i) +
          "," +
          Math.round(n) +
          "," +
          Math.round(o) +
          "," +
          Math.round(s) +
          "," +
          Math.round(c);
      u !== t.measured &&
        ((t.measured = u),
        (t.mx.style.width = r.toFixed(1) + "px"),
        (t.mx.style.transform = "translate(" + (-r).toFixed(1) + "px," + c.toFixed(1) + "px)"),
        (t.my.style.height = i.toFixed(1) + "px"),
        (t.my.style.transform = "translate(" + s.toFixed(1) + "px," + (-i).toFixed(1) + "px)"));
    }
  }
  function ge(t) {
    var e = t.job.tasks["x" === t.snap ? 1 : 0];
    if (e && e.line)
      try {
        e.line.animate([{ opacity: 1 }, { opacity: 0.55 }], { duration: 650, easing: "ease-out" });
      } catch (t) {}
  }
  function we(t, e) {
    var n = 0,
      o = 0;
    function r(e) {
      ((n = e.x - t.grab.x),
        (o = e.y - t.grab.y),
        (t.el.style.transform = "translate(" + n.toFixed(1) + "px," + o.toFixed(1) + "px)"),
        me(t, e));
    }
    return (
      (t.grab = { x: t.docLeft + Math.min(0.3 * t.width, 150), y: t.docTop + Math.min(0.06 * t.height, 24) }),
      [
        ue(function () {
          ((n = Math.max(0, D + I - t.docLeft - 0.32 * t.width)), (o = Math.min(60, 0.06 * V)));
        }),
        de(function () {
          return { x: t.grab.x + n, y: t.grab.y + o };
        }, 1),
        ue(function (n) {
          ((n.press = 1),
            setAgentShape(n, "arrow"),
            r(n),
            Yt(t.el),
            (e.dataset.state = "active"),
            (e.style.width = t.width + "px"),
            (e.style.height = t.height + "px"),
            he(t, t.width, t.height));
          try {
            t.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
          } catch (t) {}
          borrowCarryHelpers(t);
        }),
        se(0.18),
        de(
          function () {
            return t.grab;
          },
          0.3,
          { drag: !0, bend: 0.05, frame: r },
        ),
        ue(function (n) {
          ((n.press = 1), landCarry(t), e.remove());
        }),
        se(0.25),
      ]
    );
  }
  function be(t) {
    var e = de(function () {
        return ae(t);
      }, 1),
      n = t.outline;
    if ("carry" === t.op) return we(t, n);
    if ("guide" === t.kind)
      return [
        e,
        ue(function (e) {
          ((e.press = 1), setAgentShape(e, ce(t)), ye(t), xe(t, e));
        }),
        de(
          function () {
            return le(t);
          },
          0.55,
          {
            drag: !0,
            frame: function (e) {
              xe(t, e);
            },
          },
        ),
        ue(function (t) {
          setAgentShape(t, "arrow");
        }),
        se(0.25),
      ];
    if (t.textual && "copy" === t.stage) {
      var o = t.source,
        r = t.m.boxed,
        i = r ? o.width : o.textWidth,
        a = r ? o.height : o.textHeight;
      t.grab = r
        ? {
            x: o.docLeft + Math.min(0.45 * o.width, 70) + lt(-8, 8),
            y: o.docTop + Math.min(0.45 * o.height, 30) + lt(-4, 4),
          }
        : {
            x: o.textLeft + Math.min(0.5 * o.textWidth, 40) + lt(-4, 4),
            y: o.textTop + 0.5 * o.textHeight + lt(-2, 2),
          };
      var l = function (e) {
        (me(t, e),
          (t.typing.style.transform =
            "translate(" +
            (e.x - t.grab.x - t.textLeft + o.textLeft).toFixed(1) +
            "px," +
            (e.y - t.grab.y - t.textTop + o.textTop).toFixed(1) +
            "px)"));
      };
      return [
        de(function () {
          return t.grab;
        }, 1),
        ue(function (t) {
          t.press = 1;
        }),
        se(0.07),
        ue(function () {
          ((n.dataset.state = "active"),
            (n.style.width = i + "px"),
            (n.style.height = a + "px"),
            he(t, i, a));
        }),
        se(lt(0.15, 0.3)),
        ue(function (t) {
          setAgentShape(t, "dup");
        }),
        se(0.12),
        ue(function (e) {
          ((e.press = 1),
            (t.textNode.textContent = t.was),
            t.typing.classList.add("wv-carried"),
            (t.typing.style.width = Math.max(t.textWidth, o.textWidth) + 2 + "px"),
            l(e));
        }),
        de(
          function () {
            return le(t);
          },
          0.6,
          { drag: !0, frame: l },
        ),
        se(0.1),
        ue(function (e) {
          (setAgentShape(e, "arrow"),
            n.remove(),
            (t.typing.style.transform = ""),
            (t.landed = !0),
            r && (t.el.classList.add("wv-text-wait"), Yt(t.el)));
        }),
        se(0.35),
      ];
    }
    if ("dup" === t.op) {
      var c = t.source,
        s = t.job.tasks.filter(function (e) {
          return e.carried === t;
        });
      return (
        (t.grab = {
          x: c.docLeft + Math.min(0.45 * c.width, 70) + lt(-8, 8),
          y: c.docTop + Math.min(0.45 * c.height, 30) + lt(-4, 4),
        }),
        [
          de(function () {
            return t.grab;
          }, 1),
          ue(function (t) {
            t.press = 1;
          }),
          se(0.07),
          ue(function () {
            ((n.dataset.state = "active"),
              (n.style.width = t.width + "px"),
              (n.style.height = t.height + "px"),
              he(t, t.width, t.height));
          }),
          se(lt(0.15, 0.3)),
          ue(function (t) {
            setAgentShape(t, "dup");
          }),
          se(0.12),
          ue(function (e) {
            ((e.press = 1), me(t, e));
          }),
          de(
            function () {
              return le(t);
            },
            0.6,
            {
              drag: !0,
              frame: function (e) {
                me(t, e);
              },
            },
          ),
          se(0.1),
          ue(function (e) {
            (setAgentShape(e, "arrow"),
              Yt(t.el),
              s.forEach(finishBuildTask),
              t.edits.forEach(function (t) {
                (t.outline.remove(), (t.textNode.textContent = t.was), t.typing.classList.add("wv-carried"));
              }));
          }),
          se(0.35),
        ]
      );
    }
    if ("edit" === t.op)
      return [
        de(function () {
          return {
            x: t.textLeft + Math.min(0.5 * t.textWidth, 50) + lt(-5, 5),
            y: t.textTop + 0.55 * t.m.lineHeight,
          };
        }, 1),
        ue(function (t) {
          t.press = 1;
        }),
        se(0.08),
        ue(function (e) {
          ((e.press = 1), t.typing.classList.add("wv-typing-on", "wv-selected"), setAgentShape(e, "ibeam"));
        }),
        se(lt(0.2, 0.35)),
        ue(function () {
          (t.typing.classList.remove("wv-selected", "wv-carried"),
            (t.typing.style.width = t.textWidth + 2 + "px"),
            (t.typed = 0),
            (t.textNode.textContent = ""));
        }),
        fe(t),
        se(0.12),
        ue(function (t) {
          setAgentShape(t, "arrow");
        }),
        se(0.3),
      ];
    if ("connect" === t.op)
      return [
        e,
        ue(function (e) {
          ((e.press = 1), setAgentShape(e, ce(t)));
        }),
        se(0.07),
        ue(function () {
          var e = ae(t),
            n = le(t),
            o = t.height > t.width ? "scaleY(" : "scaleX(";
          (Yt(t.el),
            Xt(
              t,
              t.el,
              [
                { transformOrigin: "0 0", transform: o + "0.01)" },
                { transformOrigin: "0 0", transform: o + "1)" },
              ],
              {
                duration:
                  (at(0.12 + 0.021 * Math.sqrt(Math.hypot(n.x - e.x, n.y - e.y)), 0.14, 0.9) / k) * 1e3,
                easing: "cubic-bezier(.33,1,.68,1)",
                fill: "backwards",
              },
            ));
        }),
        de(
          function () {
            return le(t);
          },
          1,
          { bend: lt(0, 0.03) },
        ),
        ue(function (t) {
          t.press = 1;
        }),
        se(0.07),
        se(lt(0.04, 0.12)),
        ue(function (e) {
          (setAgentShape(e, "arrow"), (t.away = { x: e.x + lt(14, 30), y: e.y + lt(10, 24) }));
        }),
        de(function () {
          return t.away;
        }, 1.4),
        se(0.3),
      ];
    var u = "type" === t.op && !t.m.boxed,
      d = [
        e,
        ue(function (e) {
          ((e.press = 1), setAgentShape(e, "cross"), (t.a = { x: e.x, y: e.y }), (n.dataset.state = "active"));
        }),
        de(
          function () {
            return le(t);
          },
          u ? 0.9 : 0.75,
          { drag: !0, bend: 0, frame: pe(t) },
        ),
      ];
    return "hands" === t.op && t.m.image
      ? d.concat([
          ue(function (e) {
            (setAgentShape(e, "arrow"),
              Yt(t.el),
              (function (t, e, n, o, r, i) {
                var a = t.el;
                if (e && n && n.width && n.height) {
                  var l = { image: e, opacity: e.style.opacity || "", clones: [], layer: null, failed: null };
                  ((l.failed = function () {
                    finishSection(t.job);
                  }),
                    (t.hands = l),
                    a.classList.add("wv-hands-active"),
                    e.addEventListener("error", l.failed, { once: !0 }));
                  var c = document.createElement("span");
                  ((c.className = "wv-hands-layer"),
                    c.setAttribute("aria-hidden", "true"),
                    (c.style.left = n.left - o.left - r.left + "px"),
                    (c.style.top = n.top - o.top - r.top + "px"),
                    (c.style.width = n.width + "px"),
                    (c.style.height = n.height + "px"),
                    (l.layer = c),
                    ["robot", "human"].forEach(function (t) {
                      var n = document.createElement("span"),
                        o = document.createElement("img");
                      ((n.className = "wv-hand-piece wv-hand-" + t),
                        (n.dataset.hand = t),
                        o.addEventListener("error", l.failed, { once: !0 }),
                        (o.src = e.currentSrc),
                        (o.alt = ""),
                        l.clones.push(o),
                        n.appendChild(o),
                        c.appendChild(n));
                    }),
                    t.job.overlay.appendChild(c),
                    (l.robot = c.children[0]),
                    (l.human = c.children[1]),
                    Xt(t, l.robot, [{ transform: "translateX(-38%)" }, { transform: "translateX(0%)" }], i),
                    Xt(t, l.human, [{ transform: "translateX(42%)" }, { transform: "translateX(0%)" }], {
                      delay: 0.08 * i.duration,
                      duration: 0.92 * i.duration,
                      easing: i.easing,
                      fill: "backwards",
                    }),
                    (e.style.opacity = "0"));
                }
              })(t, t.m.image, t.m.imageRect, t.job.hostRect, t.job.inset, {
                delay: 0,
                duration: (1.6 / k) * 1e3,
                easing: "cubic-bezier(.33,1,.68,1)",
                fill: "backwards",
              }));
          }),
          se(1.6),
        ])
      : "type" !== t.op
        ? d.concat([
            ue(function (t) {
              setAgentShape(t, "arrow");
            }),
            se(lt(0.18, 0.3)),
            ue(function () {
              !(function (t) {
                if ((Yt(t.el), !t.m.interactive))
                  try {
                    t.el.animate(
                      [
                        { transform: "translate(" + lt(-14, 14).toFixed(1) + "px,10px)" },
                        { transform: "translate(0px,0px)" },
                      ],
                      { duration: 260, easing: "cubic-bezier(.33,1,.68,1)" },
                    );
                  } catch (t) {}
              })(t);
            }),
            se(0.35),
          ])
        : (u ||
            d.push(
              ue(function (t) {
                setAgentShape(t, "arrow");
              }),
              se(lt(0.18, 0.3)),
              ue(function () {
                (t.el.classList.add("wv-text-wait"), Yt(t.el));
              }),
              se(0.35),
            ),
          d.push(
            ue(function (e) {
              (n.remove(),
                t.typing.classList.add("wv-typing-on"),
                setAgentShape(e, "ibeam"),
                (t.park = { x: e.x + lt(-30, 10), y: e.y + lt(10, 30) }));
            }),
            de(function () {
              return t.park;
            }, 1.5),
            fe(t),
            se(0.12),
            ue(function (t) {
              setAgentShape(t, "arrow");
            }),
          ),
          t.grow &&
            ([24, 32, 40, 48, 56, 64, 72]
              .filter(function (e) {
                return e > t.size && e < t.m.size;
              })
              .concat([t.m.size])
              .forEach(function (e) {
                d.push(
                  se(0.06),
                  ue(function () {
                    Kt(t, e);
                  }),
                );
              }),
            d.push(se(0.15))),
          d.concat(
            t.snap
              ? (function (t) {
                  var e, n, o;
                  function r(e) {
                    var o = e.x - n.x,
                      r = e.y - n.y;
                    ("x" === t.snap && Math.abs(o) < 9 && (o && t.ox && ge(t), (o = 0)),
                      "y" === t.snap && Math.abs(r) < 9 && (r && t.oy && ge(t), (r = 0)),
                      (t.ox = o),
                      (t.oy = r),
                      Qt(t));
                  }
                  return [
                    function () {
                      var e = t.job.tasks["x" === t.snap ? 1 : 0];
                      return !e || e.complete;
                    },
                    ue(function () {
                      e = {
                        x: t.textLeft + t.ox + Math.min(0.4 * t.textWidth, 60) + lt(-6, 6),
                        y: t.textTop + t.oy + Math.min(0.5 * t.textHeight, 22),
                      };
                    }),
                    de(function () {
                      return e;
                    }, 1),
                    ue(function (r) {
                      ((r.press = 1),
                        (n = { x: e.x - t.ox, y: e.y - t.oy }),
                        (o = {
                          x: n.x + ("x" === t.snap ? -lt(2, 5) : lt(-6, 6)),
                          y: n.y + ("y" === t.snap ? -lt(2, 5) : lt(-3, 3)),
                        }));
                    }),
                    de(
                      function () {
                        return o;
                      },
                      0.6,
                      { drag: !0, frame: r },
                    ),
                    se(0.1),
                    de(
                      function () {
                        return n;
                      },
                      2,
                      { frame: r },
                    ),
                    ue(function () {
                      ((t.ox = t.oy = 0), Qt(t));
                    }),
                    se(0.25),
                  ];
                })(t)
              : [se(0.2)],
          ));
  }
  function borrowCarryHelpers(job) {
    const grips = [
      { x: job.width - 26, y: job.height - 30 },
      { x: 30, y: job.height - 40 },
    ];
    job.helpers = freeAgents().slice(0, grips.length);
    job.helpers.forEach((agent, index) => {
      agent.grip = grips[index];
      claimAgent(agent, job, "carry");
    });
  }

  function releaseBuildWorkers(job) {
    const worker = job.worker;
    const helpers = job.helpers || [];
    job.worker = null;
    job.helpers = null;
    if (worker) releaseAgent(worker);
    helpers.forEach(releaseAgent);
  }

  function moveCarryHelper(agent, job, elapsed) {
    const dx = job.docLeft + job.shiftX + agent.grip.x - agent.x;
    const dy = job.docTop + job.shiftY + agent.grip.y - agent.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.5) {
      const progress = Math.min(1, 14 * elapsed, 2200 * elapsed / distance);
      agent.x += dx * progress;
      agent.y += dy * progress;
    }
    agent.press = distance < 30 ? 1 : 0;
  }

  function advanceAgent(agent, elapsed) {
    if (agent.parked) return;
    const job = agent.job;
    agent.press = Math.max(0, agent.press - 6 * elapsed);
    if (!job) {
      if (!agent.path) zt(agent, () => home(agent), 2.4);
      if (Ht(agent, elapsed)) {
        parkAgent(agent);
        if (agent.number > crewSize) removeAgent(agent);
        updateRestCard();
        return;
      }
    } else if (agent.grip) {
      moveCarryHelper(agent, job, elapsed);
    } else {
      const outside = agent.x < D || agent.x > D + I || agent.y < $ || agent.y > $ + V;
      if (job.kind !== "tidy" && outside && !ie(job)) elapsed *= 4;
      while (agent.job === job && job.steps.length && job.steps[0](agent, elapsed)) {
        job.steps.shift();
        elapsed = 0;
      }
      if (agent.job === job && !job.steps.length) {
        if (job.kind === "tidy") finishTidyItem(job);
        else if (job.textual && job.stage === "copy" && job.op === "edit") {
          job.stage = "retype";
          job.waitFor = null;
          job.waitGroup = job.copies;
          releaseBuildWorkers(job);
        } else finishBuildTask(job);
      }
    }
    if (enabled) drawAgent(agent);
  }

  function updateGuide(guide) {
    if (!guide.complete) return;
    const axis = guide.horizontal ? "y" : "x";
    const aligning = guide.job.tasks.filter(task => task.snap === axis);
    if (aligning.some(task => !task.complete && task.docTop <= oe(task.job))) {
      if (guide.goneAt == null) return;
      if (guide.line) guide.line.classList.remove("wv-guide-done", "wv-guide-free");
      else {
        ye(guide);
        xe(guide, { x: guide.at, y: guide.at });
        Xt(guide, guide.line, [{ opacity: 0 }, { opacity: 0.55 }], { duration: 300, easing: "ease-out" });
      }
      guide.goneAt = null;
    } else if (guide.line) {
      if (guide.goneAt == null) {
        guide.line.classList.add(aligning.length ? "wv-guide-done" : "wv-guide-free");
        guide.goneAt = M + (aligning.length ? 2.1 : 0.9);
      } else if (M >= guide.goneAt) {
        guide.line.remove();
        guide.line = null;
      }
    }
  }

  function buildJobReady(job) {
    if (job.complete || job.worker || job.carried) return false;
    if (job.kind === "guide") return true;
    if (job.docTop > oe(job.job) || (job.after && !job.after.complete)) return false;
    if (job.waitFor && !job.waitFor.every(wt)) return false;
    if (job.waitGroup && !job.waitGroup.every(re)) return false;
    if (job.snap) {
      const guide = job.job.tasks[job.snap === "x" ? 1 : 0];
      // A snap can wait only for a guide that already has an agent.
      if (guide && !guide.complete && !guide.worker) return false;
    }
    return true;
  }

  function readyBuildJobs() {
    if (!constructionActive) return [];
    if (scrollSettled || !fineInput.matches) S = Math.max(S, $ + V);
    const ready = [];
    let settleBudget = crewSize === 8 ? 5 : 10;
    for (const section of sections) {
      if (!section.started || section.done) continue;
      if (section.stale) {
        if (!section.tasks.some(job => job.worker)) finishSection(section);
        continue;
      }
      if (section.docTop + section.hostRect.height < $ - 40) {
        for (const job of section.tasks) {
          if (!settleBudget) break;
          if (!job.complete) {
            finishBuildTask(job);
            settleBudget--;
          }
        }
        if (section.tasks.every(job => job.complete)) finishSection(section);
        else needsBuildFrame = true;
        continue;
      }
      if (section.tasks.every(job => job.complete)) {
        finishSection(section);
        continue;
      }
      for (const job of section.tasks) {
        if (job.kind === "guide") updateGuide(job);
        if (buildJobReady(job)) ready.push(job);
      }
    }
    return ready.sort((first, second) => ie(second) - ie(first) || first.docTop - second.docTop);
  }

  function startBuildJobs(jobs, freeAgents) {
    const running = agents.filter(agent => agent.job && agent.job.worker === agent && agent.job.kind !== "tidy").length;
    const slots = Math.min(freeAgents.length, (crewSize === 8 ? 8 : 12) - running, jobs.length);
    for (let index = 0; index < slots; index++) {
      const job = jobs[index];
      const agent = freeAgents.shift();
      job.worker = agent;
      claimAgent(agent, job, job.textual && job.stage === "copy" ? "dup" : job.op);
      if (job.kind === "guide") {
        job.fromX = at(agent.x - D, 60, I - 60);
        job.fromY = at(agent.y - $, 60, V - 60);
      }
      job.steps = be(job);
    }
  }

  function showRulers(show) {
    if (!rulers) return;
    rulers.classList.toggle("wv-on", show);
    root.classList.toggle("wv-ruling", show);
  }

  function updateRulers() {
    if (!rulers) return;
    if (agents.some(agent => agent.job && agent.job.kind === "guide")) {
      clearTimeout(rulerTimer);
      rulerTimer = 0;
      if (!rulers.classList.contains("wv-on")) showRulers(true);
    } else if (rulers.classList.contains("wv-on") && !rulerTimer) {
      rulerTimer = setTimeout(() => {
        rulerTimer = 0;
        showRulers(false);
      }, 700);
    }
  }

  function render(now) {
    frame = 0;
    if (!enabled || document.hidden) return;
    const elapsed = lastFrame ? at((now - lastFrame) / 1000, 0.001, 0.05) : 1 / 60;
    lastFrame = now;
    M += elapsed;
    try {
      if (!gridRect) gridRect = cardGrid.getBoundingClientRect();
      needsBuildFrame = false;
      const jobs = readyBuildJobs();
      if (!enabled) return;
      k = at(2.1 + jobs.length / crewSize * 0.5, 2.1, 3.6);
      const free = freeAgents();
      startBuildJobs(jobs, free);
      startTidyJobs(free);
      updateRulers();
      for (const agent of agents.slice()) {
        if (!enabled) return;
        advanceAgent(agent, elapsed);
        const job = agent.job;
        if (job && job.worker === agent && job.outline && !job.complete) ve(job);
      }
      wake();
      if (!frame) lastFrame = 0;
      finishOpeningIfIdle();
    } catch (_) {
      failOpen();
    }
  }

  function wake() {
    if (!frame && enabled && !document.hidden &&
        (needsBuildFrame || tidyBatch || agents.some(agent => !agent.parked))) {
      frame = requestAnimationFrame(render);
    }
  }

  function stopFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }

  function requestBuildFrame() {
    if (!constructionActive || !sections.some(section => section.started && !section.done)) return;
    needsBuildFrame = true;
    wake();
  }

  function onScroll() {
    readScroll();
    if (!constructionActive) return;
    if (fineInput.matches) {
      scrollSettled = false;
      clearTimeout(restTimer);
      restTimer = setTimeout(onRest, 700);
    } else requestBuildFrame();
  }

  function onRest() {
    if (!constructionActive || !fineInput.matches) return;
    clearTimeout(restTimer);
    restTimer = 0;
    scrollSettled = true;
    readScroll();
    const nav = document.getElementById("nav");
    const navBottom = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
    const visibleSections = sections.filter(section => !section.started && !section.done)
      .map(section => ({ section, rect: section.host.getBoundingClientRect() }));
    for (const { section, rect } of visibleSections) {
      if (!rect.height) continue;
      if (rect.bottom <= navBottom + 1) finishSection(section);
      else {
        const visible = Math.min(rect.bottom, V) - Math.max(rect.top, navBottom);
        if (visible > 0 && (visible / rect.height >= 0.1 || visible / Math.max(1, V - navBottom) >= 0.3)) {
          queueSection(section);
        }
      }
    }
    requestBuildFrame();
    awaitingOpeningSections = false;
    finishOpeningIfIdle();
  }

  function onResize() {
    const width = root.clientWidth || innerWidth;
    if (width !== I) {
      // Let work in flight finish before revealing sections with stale geometry.
      for (const section of sections) if (section.started && !section.done) section.stale = true;
    }
    I = width;
    V = innerHeight;
    readScroll();
    if (!enabled) return;
    if (crewSize !== crewFor()) syncCrewSize();
    gridRect = null;
    requestBuildFrame();
    wake();
  }

  function releaseLoader() {
    document.dispatchEvent(new CustomEvent("wv-loader-release"));
  }

  function startConstruction(hosts) {
    const positions = hosts.map(host => ({
      host, relative: getComputedStyle(host).position === "static", visible: host.getClientRects().length > 0,
      pieces: qt(host),
    }));
    for (const { host, relative, visible, pieces } of positions) {
      if (relative) host.classList.add("wv-job");
      host.dataset.wvBuild = visible ? "waiting" : "complete";
      sections.push({ host, pieces, started: false, done: !visible, overlay: null, tasks: [] });
      if (visible) pieces.forEach(Wt);
    }
    root.classList.add("wv-construct");
    rulers = document.createElement("span");
    rulers.className = "wv-rulers";
    rulers.setAttribute("aria-hidden", "true");
    rulers.innerHTML = '<span class="wv-ruler-x"></span><span class="wv-ruler-y"></span>';
    document.body.appendChild(rulers);

    awaitingOpeningSections = true;
    observer = new IntersectionObserver(entries => {
      if (!constructionActive || (!scrollSettled && fineInput.matches)) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const section = sections.find(section => section.host === entry.target);
        if (section) queueSection(section);
      }
      awaitingOpeningSections = false;
      finishOpeningIfIdle();
    }, { threshold: 0.1 });
    for (const section of sections) if (!section.done) observer.observe(section.host);
    try {
      sessionStorage.setItem("wv-built", "1");
    } catch (_) {}
    if (sections.every(section => section.done)) finishConstruction();
  }

  function finishOpeningIfIdle() {
    // Sections farther down the page can still build when they come into view.
    if (!building || awaitingOpeningSections || prepareTimer || needsBuildFrame ||
        agents.some(agent => !agent.parked)) return;
    building = false;
  }

  function finishConstruction() {
    constructionActive = building = awaitingOpeningSections = false;
    needsBuildFrame = false;
    clearTimeout(prepareTimer);
    clearTimeout(restTimer);
    clearTimeout(rulerTimer);
    prepareTimer = restTimer = rulerTimer = 0;
    pendingSections.length = 0;
    if (observer) observer.disconnect();
    observer = null;
    root.classList.remove("wv-construct", "wv-ruling");
    if (rulers) rulers.remove();
    rulers = null;
  }

  function disableCrew() {
    enabled = false;
    stopFrame();
    finishConstruction();
    sections.forEach(finishSection);
    settleTidy();
    root.classList.remove("wv-loader-pending", "wv-loader-leaving");
    if (layer) layer.remove();
    layer = card = cardStatus = cardGrid = gridRect = null;
    dispatchEvent(new Event("wv-card"));
    agents.length = 0;
  }

  function failOpen() {
    failed = true;
    disableCrew();
  }

  function syncMotion(opening = false) {
    if (failed || pageAway || !root.classList.contains("wv-motion")) {
      if (enabled) disableCrew();
      return;
    }
    if (enabled) return;
    try {
      readScroll();
      enabled = true;
      // Phones: the hero copy shows at once; the crew builds the rest.
      const hosts = opening ? [...document.querySelectorAll("[data-build]")].filter(host => desktop.matches || !host.closest(".hero")) : [];
      constructionActive = building = hosts.length > 0;
      createCrew();
      if (constructionActive) startConstruction(hosts);
    } catch (_) {
      failOpen();
    }
  }

  if (!desktop || !Element.prototype.animate || !Element.prototype.closest ||
      typeof requestAnimationFrame !== "function" || typeof cancelAnimationFrame !== "function") {
    releaseLoader();
    return;
  }

  window.addEventListener("wv-motion-change", () => syncMotion());
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("wv-rest", onRest);
  window.addEventListener("resize", onResize);
  document.addEventListener("focusin", event => {
    if (!constructionActive) return;
    for (const section of sections) {
      if (!section.done && section.host.contains(event.target)) finishSection(section);
    }
    requestBuildFrame();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopFrame();
    else wake();
  });
  window.addEventListener("pagehide", () => {
    pageAway = true;
    if (enabled) disableCrew();
  });
  window.addEventListener("pageshow", () => {
    pageAway = false;
    syncMotion();
  });

  const opening = root.classList.contains("wv-loader-pending") && !root.classList.contains("wv-loader-leaving");
  syncMotion(opening);
  releaseLoader();
})();
