// Section snapping for the homepage. Every part is at least one screen tall below the nav (CSS), and when the visitor stops
// scrolling with a part boundary inside the screen, the page glides the rest of the way to the next part's top in the
// direction they were going (or back to the end of a tall part if going on would skip anything they have not seen).
// It never acts while a scroll is running, never moves more than one screen from the last resting view, scrolls tall parts
// freely, and stays off on short windows (under 560 px tall, which includes 200% zoom on a laptop), with pinch zoom, while
// a pointer or finger is down, and when the move would hide the focused element.
// A finger scroll on a phone (a flick or a drag) is the phone's own: the page waits until the fling has fully stopped and then
// only finishes the last short way to a part top when one is within a fifth of a screen, so it never adds or takes back
// a real distance from the flick.
// Why not CSS scroll-snap: measured in Chrome, mandatory snapping skipped up to 329 px of a tall part on Page Down and held
// the page in place on mouse wheel notches; this keeps the CSS snap model without those faults.
(function(){
  const nav = document.getElementById('nav'), main = document.getElementById('main'), foot = document.querySelector('body > .site-footer');
  if(!nav || !main || !window.matchMedia) return;
  const tall = matchMedia('(min-height:560px)'), reduce = matchMedia('(prefers-reduced-motion:reduce)');
  let lastRest = scrollY, held = 0, timer = 0, aim = null, byFinger = false;
  // after a finger scroll: how near a part top must be to settle on it, and how long the page must be still first
  const FINGER_REACH = 0.2, FINGER_QUIET = 250;
  // A trackpad swipe is a stream of small wheel events, and Chrome can end the scroll (scrollend) in a gap between two of
  // them. The page counts as still only once no wheel event has come for WHEEL_QUIET ms (a swipe's own gaps stay under
  // about 200 ms), so it neither glides nor starts cursor work in the middle of a swipe. Only with a mouse or trackpad (fine):
  // phones keep round 5's timing.
  const WHEEL_QUIET = 300, fine = matchMedia('(hover:hover) and (pointer:fine)');
  let wheelAt = -1e9;
  // The page has come to rest (no glide to make, or its glide has arrived): the cursor crew (js/swarm-motion.js) and the
  // scroll story (js/hero-motion.js) start their work on what is on screen now.
  function settled(y){
    lastRest = y;
    try { dispatchEvent(new CustomEvent('wv-rest', { detail: { y } })); } catch(e){}
  }

  // The pages. On desktop windows (at least 901 px wide and 560 px tall) every part of the homepage is one snap page (marked
  // data-snap-page) when its content fits one screen below the nav, and a part that is too tall for the window is split into
  // its own smaller pages (its .pg blocks, each at least one screen tall, CSS styles/fit.css), so every page fits the screen
  // it is shown on. A part is never split when one of its blocks would show almost nothing on a screen of its own (under a
  // fifth of the screen, for example just the scenario comparison bar): it then stays one page and scrolls freely, as a tall
  // part does. Phones, tablets and short windows mark nothing and keep round 3's pages (main's header and sections) and do
  // no work here at all. This only reads the layout at load, when the fonts arrive and when the window changes size, never
  // while scrolling.
  const desk = matchMedia('(min-width:901px) and (min-height:560px)'), LONE = 0.2;
  let marked = false;
  // the height of a .pg block's own content (its children's boxes; the block itself has no box while not split)
  function blockHeight(pg){
    let top = Infinity, bottom = -Infinity;
    for(const c of pg.children){ const r = c.getBoundingClientRect(); if(r.height){ top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom); } }
    return bottom > top ? bottom - top : 0;
  }
  function markPages(){
    if(!marked && !desk.matches) return;
    const secs = [...main.children].filter(e => e.matches('header,section'));
    secs.forEach(s => { s.classList.remove('fit-split'); s.removeAttribute('data-snap-page'); s.querySelectorAll('[data-snap-page]').forEach(e => e.removeAttribute('data-snap-page')); });
    marked = desk.matches;
    if(!marked) return;
    const seen = innerHeight - nav.getBoundingClientRect().height;
    const split = secs.filter(s => {
      const wrap = s.querySelector(':scope>.wrap'), pgs = wrap ? [...wrap.querySelectorAll(':scope>.pg')] : [];
      return pgs.length && wrap.getBoundingClientRect().bottom - s.getBoundingClientRect().top > seen + 1 && pgs.every(pg => blockHeight(pg) >= seen * LONE);
    });
    secs.forEach(s => {
      if(split.includes(s)){ s.classList.add('fit-split'); s.querySelectorAll(':scope>.wrap>.pg').forEach(e => e.setAttribute('data-snap-page', '')); }
      else s.setAttribute('data-snap-page', '');
    });
  }
  markPages();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(markPages);
  let size = innerWidth + 'x' + innerHeight;
  addEventListener('resize', () => { const now = innerWidth + 'x' + innerHeight; if(now !== size){ size = now; markPages(); } });

  // The parts: every snap page (or, with nothing marked, the hero and every section, as in round 3), the last one together
  // with the footer (one screen at the end of the page).
  function parts(){
    const els = marked ? main.querySelectorAll('[data-snap-page]') : [...main.children].filter(e => e.matches('header,section'));
    const list = [...els].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; });
    if(foot && list.length){ const r = foot.getBoundingClientRect(); list[list.length - 1].bottom = r.bottom + scrollY; }
    return list;
  }
  function geometry(){
    const navH = nav.getBoundingClientRect().height, vh = innerHeight, max = document.documentElement.scrollHeight - vh, seen = vh - navH;
    const list = parts(), stops = new Set();
    list.forEach(p => {
      stops.add(Math.round(Math.min(max, Math.max(0, p.top - navH))));
      if(p.bottom - p.top > seen + 0.5) stops.add(Math.round(Math.min(max, Math.max(0, p.bottom - vh))));
    });
    return { navH, vh, seen, max, list, stops: [...stops].sort((a, b) => a - b) };
  }
  // A boundary between two parts sits inside the screen (below the nav, above the bottom edge).
  function cut(g, y){ return g.list.some(p => [p.top, p.bottom].some(b => b > y + g.navH + 3 && b < y + g.vh - 3 && b < g.max + g.vh - 3)); }
  function focusStays(dy){
    const a = document.activeElement;
    if(!a || a === document.body || nav.contains(a)) return true;
    // a place the page moved focus to by itself (tabindex -1, not a control, for example the scroll story after its clean-up)
    // keeps the reading position for the keyboard but does not hold the page
    if(a.getAttribute('tabindex') === '-1') return true;
    const r = a.getBoundingClientRect(), navH = nav.getBoundingClientRect().height;
    const seenNow = r.bottom > navH && r.top < innerHeight;
    return !seenNow || (r.bottom - dy > navH && r.top - dy < innerHeight);
  }
  function rest(){
    timer = 0;
    // a new scroll began after this one ended (an anchor link, a key): leave it alone, its own end comes later
    if(performance.now() - moved < 30 || Math.abs(scrollY - endY) > 1) return;
    // a finger scroll: the fling can pause between the finger lifting and gliding on, so wait for real stillness
    if(byFinger && !held && performance.now() - moved < FINGER_QUIET){ endY = scrollY; timer = setTimeout(rest, FINGER_QUIET - (performance.now() - moved)); return; }
    // a wheel or trackpad swipe may still be going on: wait until its events have stopped
    const sinceWheel = performance.now() - wheelAt;
    if(!byFinger && fine.matches && sinceWheel < WHEEL_QUIET){ endY = scrollY; timer = setTimeout(rest, WHEEL_QUIET - sinceWheel); return; }
    const finger = byFinger; byFinger = false;
    const y = scrollY;
    document.documentElement.removeAttribute('data-auto-scroll');
    if(aim !== null && Math.abs(y - aim) < 2){ aim = null; settled(y); return; }
    aim = null;
    if(!tall.matches || held || (window.visualViewport && visualViewport.scale > 1.01)){ settled(y); return; }
    const g = geometry();
    if(!cut(g, y)){ settled(y); return; }
    const prev = lastRest, ahead = g.stops.filter(s => s > y + 1), behind = g.stops.filter(s => s < y - 1).reverse();
    let pick = null;
    if(finger){
      // the nearest stop within reach, ahead or behind; farther than that, the page stays where the flick left it. Ahead only
      // if nothing between the last resting view and the new one would go unseen (3 px of slack for rounding).
      const reach = g.vh * FINGER_REACH, a = ahead[0], b = behind[0];
      const okA = a != null && a - y <= reach && a - Math.min(prev, y) <= g.seen + 3, okB = b != null && y - b <= reach;
      pick = okA && (!okB || a - y <= y - b) ? a : okB ? b : null;
    } else if(Math.abs(y - prev) > g.seen){
      // a move of more than a screen (a fast wheel spin, the scroll bar, a link or a script bringing something into view):
      // the visitor did not read the content in between, so it settles on the nearest page top (less than a screen away,
      // since a boundary is on screen), which keeps most of what the move brought on screen. Now that a short page fits the
      // screen, its last control can sit near the bottom, and carrying on in the move's direction would scroll it away.
      const a = ahead[0], b = behind[0];
      pick = a == null ? b : b == null ? a : (a - y <= y - b ? a : b);
    } else if(y >= prev){
      // going down: the next stop if it keeps within one screen of the last view (3 px of slack for rounding, which only ever
      // falls in a part's padding), else the last stop passed on the way
      pick = ahead.length && ahead[0] - prev <= g.seen + 3 ? ahead[0] : behind.find(s => s > prev + 1);
    } else {
      pick = behind.length && prev - behind[0] <= g.seen + 3 ? behind[0] : ahead.find(s => s < prev - 1);
    }
    if(pick == null || Math.abs(pick - y) < 2 || !focusStays(pick - y)){ settled(y); return; }
    // lastRest stays where the page really was until the glide arrives, or until new input cuts it short (then it is the place
    // where it was cut, below): never a target the page did not reach, which read a forward swipe as a move back and glided
    // back to where it began.
    aim = pick;
    // marks the glide as the page's own scroll (the cursor crew keeps the reader's pace, not the glide's)
    document.documentElement.setAttribute('data-auto-scroll', '');
    scrollTo({ top: pick, behavior: reduce.matches ? 'instant' : 'smooth' });
  }
  let moved = 0, endY = 0;
  let scrolledHeld = false;
  addEventListener('scroll', () => { moved = performance.now(); if(held) scrolledHeld = true; if(fingers) byFinger = true; }, { passive: true });
  // new input (a link, a key, the wheel, a tap) may start a new scroll: drop a settle that was about to run
  // A glide that new input cuts short ends where the page is now: that view was on screen, so it is the last rest from then on.
  ['click', 'keydown', 'wheel', 'pointerdown', 'touchstart', 'hashchange'].forEach(t => addEventListener(t, e => { if(t === 'wheel') wheelAt = performance.now(); if(aim !== null){ aim = null; lastRest = scrollY; } document.documentElement.removeAttribute('data-auto-scroll'); if(timer){ clearTimeout(timer); timer = 0; } if(t !== 'touchstart' && e.pointerType !== 'touch') byFinger = false; }, { passive: true, capture: true }));
  function soon(){ if(timer) clearTimeout(timer); endY = scrollY; timer = setTimeout(rest, 'onscrollend' in window ? 40 : 160); }
  if('onscrollend' in window) addEventListener('scrollend', soon, { passive: true });
  else addEventListener('scroll', soon, { passive: true });
  // held: a mouse button or fingers are down (text selection, dragging the demo's nodes, a finger resting on the screen)
  let mouse = false, fingers = 0;
  // a release settles only a scroll made while held (a scroll bar drag, a finger drag); a plain click or tap never moves the page
  const sync = () => { held = (mouse ? 1 : 0) + fingers; if(!held && scrolledHeld){ scrolledHeld = false; soon(); } };
  addEventListener('pointerdown', e => { if(e.pointerType === 'mouse'){ mouse = true; held = 1 + fingers; } }, { passive: true });
  addEventListener('pointerup', e => { if(e.pointerType === 'mouse'){ mouse = false; sync(); } }, { passive: true });
  addEventListener('touchstart', e => { fingers = e.touches.length; held = (mouse ? 1 : 0) + fingers; }, { passive: true });
  addEventListener('touchend', e => { fingers = e.touches.length; sync(); }, { passive: true });
  addEventListener('touchcancel', e => { fingers = e.touches.length; sync(); }, { passive: true });
  // The close and the footer share the last screen: the close is one screen minus the footer's height (--foot-h, CSS).
  function footHeight(){ if(foot) document.documentElement.style.setProperty('--foot-h', Math.ceil(foot.getBoundingClientRect().height) + 'px'); }
  footHeight();
  if(foot && window.ResizeObserver) new ResizeObserver(footHeight).observe(foot);
  addEventListener('resize', () => { lastRest = scrollY; });
})();
