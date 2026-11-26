// Section snapping (styles/home.css): on desktop each homepage section is one screen while every section fits
// (not at 200% text, zoom, short windows, phones or print).

// Light snapping to section starts on phones; false turns it off.
const PHONE_SNAP = false;

(function(){
  const root = document.documentElement, nav = document.getElementById('nav'), main = document.getElementById('main');
  const foot = document.querySelector('body > .site-footer'), final = main && main.querySelector(':scope > .final');
  if(!nav || !main || !foot || !final || !window.matchMedia) return;
  const desk = matchMedia('(min-width:68.8125em) and (min-height:35em)'), short = matchMedia('(max-height:43.75em)');
  const wide = matchMedia('(min-width:48em)'), vv = window.visualViewport, px = (cs, p) => parseFloat(cs[p]) || 0;
  const rect = e => e.getBoundingClientRect(), top = e => rect(e).top, navH = () => rect(nav).height;
  const units = () => [...main.querySelectorAll(':scope > [data-snap]')].filter(s => s.getClientRects().length);
  let queued = 0, aside = [];

  // height of a section's in-flow children (not its own padding or minimum height)
  function content(s){
    let a = 1e9, b = -1e9;
    for(const c of s.children){
      const cs = getComputedStyle(c);
      if(cs.display === 'none' || /absolute|fixed/.test(cs.position)) continue;
      a = Math.min(a, top(c) - px(cs, 'marginTop'));
      b = Math.max(b, rect(c).bottom + px(cs, 'marginBottom'));
    }
    return Math.max(0, b - a);
  }

  function check(){
    queued = 0;
    for(const e of aside.splice(0)) e.style.maxWidth = '';
    const isShort = short.matches;
    const phone = PHONE_SNAP && !wide.matches && parseFloat(getComputedStyle(root).fontSize) <= 16;
    root.classList.toggle('snap-phone', phone);
    final.toggleAttribute('data-snap', isShort || phone);
    root.classList.toggle('snap-short', isShort);
    if(!desk.matches || (vv && Math.abs(vv.scale - 1) > 0.01)){ root.classList.remove('snap-on', 'snap-soft'); return; }
    const vh = root.clientHeight, avail = vh - navH(), pad = Math.min(28, Math.max(12, vh * 0.022));
    const footH = rect(foot).height, finalH = isShort ? 0 : rect(final).height - px(getComputedStyle(final.firstElementChild), 'paddingBottom'), list = [], tops = [], opens = [];
    let fq;
    // each unit as the snap area sees it: content plus the gaps (the hero keeps its own padding)
    for(const s of units()){
      const cs = getComputedStyle(s), hero = s.matches('.hero'), open = !!s.querySelector('details[open]');
      const h = content(s) + px(cs, 'borderTopWidth') + px(cs, 'borderBottomWidth') + (hero ? px(cs, 'paddingTop') + px(cs, 'paddingBottom') : 2 * pad);
      let u = list.find(x => Math.abs(x.top - top(s)) < 2);
      if(!u) list.push(u = { top: top(s), h: 0, open: false });
      u.h = Math.max(u.h, h + (s.id === 'faq' ? finalH : 0));
      if(s.id === 'faq') fq = [s, u];
      u.open = u.open || open;
      // sections that share a screen start at the same height; an open answer keeps its section where it is
      if(!hero && !open) tops.push([s, u]); else if(open) opens.push(s);
    }
    const fits = list.every(u => u.open || u.h <= avail + 0.5);
    for(const [k, v] of [['--snap-pad', pad], ['--final-h', finalH], ['--foot-h', footH], ['--cta', 0]]) root.style.setProperty(k, v + 'px');
    for(const [s, u] of tops) s.style.setProperty('--snap-top', (u.c = pad + Math.max(0, (avail - u.h - (s === final ? footH : 0)) / 2)) + 'px');
    root.classList.toggle('snap-on', fits);
    // each screen at its stop lifts what the crew's card (and 8 px above and left) covers, within its room
    const c = fits && document.querySelector('.wv-rest-card'), q = c && c.getClientRects()[0];
    if(q){
      const zone = (d = 0) => ({ left: q.left - 8, top: q.top - 8 + d, right: q.right, bottom: q.bottom + d });
      for(const [s, u] of tops){ const d = top(s) - navH(); u.low = Math.max(u.low || -1e9, under(s, zone(d)) - d); }
      for(const [s, u] of tops) if(u.low > q.top - 8) s.style.setProperty('--snap-top', Math.max(pad, u.c - Math.ceil(u.low - q.top + 8)) + 'px');
      // taller windows: space under the closing band, from the FAQ screen's spare (16 px kept)
      if(fq && !isShort){
        const d = top(fq[0]) - navH(), need = Math.ceil(under(final, zone(d)) - d - q.top + 8);
        if(need > 0 && need <= avail - fq[1].h - 16 - (fq[1].open && px(getComputedStyle(fq[0]), 'paddingTop') - pad)) for(const [k, v] of [['--cta', need], ['--final-h', finalH + need]]) root.style.setProperty(k, v + 'px');
      }
      // an open answer stays put: what its stop (or the end) still has under the card is narrowed
      for(let i = 0, hit = [1]; i < 9 && hit.length; i++){
        hit = [];
        for(const s of opens){
          const d = top(s) - navH();
          under(s, zone(d), hit);
          if(fq && s === fq[0]) under(final, zone(d), hit), under(final, zone(root.scrollHeight - vh - scrollY), hit);
        }
        for(const e of hit) aside.push(e), e.style.maxWidth = Math.max(0, q.left - 8 - rect(e).left) + 'px';
      }
    }
    // snapping turns soft while an open answer's section runs past the window
    root.classList.toggle('snap-soft', fits && opens.some(s => rect(s).height > avail + 0.5));
  }
  // the lowest bottom of shown text and controls in el within box (out collects their blocks)
  function under(el, box, out){
    let low = -1e9;
    const hit = (b, e) => { low = Math.max(low, b); if(out){ const c = e.closest('a,button'); if(c) e = c.parentElement; while(/^inline/.test(getComputedStyle(e).display)) e = e.parentElement; out.includes(e) || out.push(e); } };
    const range = document.createRange(), meets = q => Math.min(q.right, box.right) - Math.max(q.left, box.left) > 0.5 && Math.min(q.bottom, box.bottom) - Math.max(q.top, box.top) > 0.5;
    // what the crew's build still hides counts as shown
    const shown = e => { for(let a = e; a !== root; a = a.parentElement){ const cs = getComputedStyle(a); if(cs.opacity === '0' && !a.matches('[data-wv-hide],[data-build]') || a === e && cs.visibility !== 'visible') return false; } return true; };
    const look = e => { for(const n of e.childNodes){
      if(n.nodeType === 3){
        if(!n.nodeValue.trim()) continue;
        range.selectNodeContents(n);
        for(const r of range.getClientRects()) if(meets(r) && shown(e)) hit(r.bottom, e);
      } else if(n.nodeType === 1){
        const r = rect(n), m = meets(r);
        if(m && n.matches('a[href],button,summary,input,select,textarea,label') && shown(n)) hit(r.bottom, n);
        if(m || !r.width && !r.height) look(n);
      }
    } };
    look(el);
    return low;
  }
  function queue(){ if(!queued) queued = requestAnimationFrame(check); }

  check();
  addEventListener('resize', queue);
  if(vv) vv.addEventListener('resize', queue);
  for(const q of [desk, short, wide]) q.addEventListener('change', queue);
  document.addEventListener('toggle', queue, true);
  addEventListener('wv-card', queue);
  if(window.ResizeObserver){
    const ro = new ResizeObserver(queue);
    for(const s of main.querySelectorAll(':scope > [data-snap], :scope > .final')) for(const c of s.children) ro.observe(c);
    ro.observe(foot);
  }

  // Back and Forward: each entry keeps the reader's section, restored after the step unless the reader moves first.
  const unitAt = y => units().filter(s => top(s) <= y).pop();
  // A fresh visit reveals the address's target, a reload keeps the browser's place, a newly loaded Back or Forward
  // shows the saved section after load.
  let back = null, how; const saved = history.state;
  try { how = performance.getEntriesByType('navigation')[0].type; } catch(e){}
  const fresh = how ? /navigate|prerender/.test(how) : !saved;
  let wait = how == 'back_forward' && saved && saved.snapUnit >= 0 && !window.readerMoved ? saved : null;
  function restore(){
    const p = back, s = p && main.children[p.snapUnit];
    if(p === wait) wait = null; // shown now (or it cannot be)
    if(!s || !root.classList.contains('snap-on')) return;
    // newly loaded: an offset now running into the next section (a closed answer or form) shows its top
    const n = p === saved && units().find(u => top(u) > top(s) + 1);
    const dy = n && top(n) - top(s) - root.clientHeight + navH() < p.snapDy ? 0 : p.snapDy;
    scrollTo({ top: top(s) + scrollY - navH() + dy, behavior: 'instant' });
  }
  // A link into a section shows the section when the target's first line fits there; otherwise this jump stays
  // unsnapped until the reader scrolls on. The new entry keeps it at once.
  function reveal(){
    let t; try { t = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch(e){}
    if(!t || !main.contains(t) || !root.classList.contains('snap-on')) return;
    const s = unitAt(top(t) + 1);
    if(!s) return;
    const fits = s === t || top(t) - top(s) + Math.min(rect(t).height, 48) <= root.clientHeight - navH();
    if(!fits) root.style.scrollSnapType = 'none';
    // at its section's start as the browser scrolls (Back undoes a jump at load)
    if(s !== t) scrollTo({ top: top(fits ? s : t) + scrollY - navH(), behavior: top(t) - top(s) > 1 ? 'instant' : 'auto' });
    mark(s, fits ? 0 : top(t) - top(s));
  }
  // the reader moving: wheel, touch, or a key that can scroll or activate
  for(const n of ['wheel', 'touchstart', 'keydown']) addEventListener(n, e => {
    if(n != 'keydown' || /^( |Enter|Tab|Page(Up|Down)|Arrow(Up|Down)|Home|End)$/.test(e.key)){ root.style.scrollSnapType = ''; back = wait = null; }
  }, { passive: true });
  // or a click on an in-page link
  addEventListener('click', e => { if(e.target.closest && e.target.closest('a[href^="#"]')) back = wait = null; }, true);
  // at rest: keep the place; the cursor crew starts its work
  const mark = (s, dy) => { try { history.replaceState(Object.assign({}, history.state, { snapUnit: [...main.children].indexOf(s), snapDy: Math.round(dy) }), ''); } catch(e){} };
  const rest = () => {
    if(back){ restore(); back = null; }
    const s = unitAt(navH() + 2);
    // the entry keeps a newly loaded page's saved section until it is shown
    if(s && !wait) mark(s, navH() - top(s));
    dispatchEvent(new CustomEvent('wv-rest', { detail: { y: scrollY } }));
  };
  const resume = p => {
    back = p;
    if(p){ setTimeout(restore); requestAnimationFrame(restore); setTimeout(() => back === p && restore(), 250); setTimeout(() => { if(back === p) back = null; }, 600); }
  };
  // a same-document step (link, Back, Forward) ends the newly loaded wait
  addEventListener('popstate', e => { wait = null; resume(e.state && e.state.snapUnit >= 0 ? e.state : null); });
  if('onscrollend' in window) addEventListener('scrollend', rest);
  else { let t = 0; addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(rest, 150); }, { passive: true }); }
  addEventListener('hashchange', () => { wait = null; if(back) restore(); else reveal(); });
  addEventListener('load', () => fresh ? reveal() : wait && resume(wait));
  if(document.fonts) document.fonts.ready.then(() => { check(); fresh && reveal(); rest(); });
  rest();
})();
