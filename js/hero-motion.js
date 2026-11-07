// The scroll story (#flow): scattered chips become one workflow. With the cursor crew running, cursors drag each chip into the
// workflow, when the visitor presses "Clean it up", once they have scrolled a third of the way in, or after 6 s at rest in it. Without the
// crew (reduced motion, Save-Data, no engine) the CSS transition tidies the chips at the same moment.
// With a mouse or trackpad the scroll-started clean-up waits until the page has come to rest (js/snap.js sends "wv-rest"), so
// the cursors never start while the page still moves. A press also shortens the story to one screen (data-short, styles/fit.css):
// the story is then one page, and the next scroll goes straight on to the next part.
// Only data attributes, transform and opacity change; CSS owns the look.
(function(){
  const flow = document.getElementById('flow');
  if(!flow) return;
  const btn = document.getElementById('flowTidy'), status = document.getElementById('flowStatus');
  const stage = flow.querySelector('.scrolly-stage'), nav = document.getElementById('nav');
  // a mouse or trackpad: cursor work waits for the page to rest (phones keep starting it as they scroll)
  const waitRest = matchMedia('(hover:hover) and (pointer:fine)');

  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce){ flow.setAttribute('data-stage','2'); flow.setAttribute('data-tidy','done'); return; }

  flow.setAttribute('data-stage','0');
  let ticking = false, active = false, tidy = 'idle'; // idle | run | done
  // Screen reader news, cleared after 4 s once it has been read out, so the status line does not linger in the page.
  let sayTimer = 0;
  function say(text){ if(!status) return; status.textContent = text; clearTimeout(sayTimer); sayTimer = setTimeout(() => { status.textContent = ''; }, 4000); }

  function finish(){
    if(tidy === 'done') return;
    tidy = 'done';
    flow.setAttribute('data-tidy','done');
    flow.setAttribute('data-stage','2');
    say('Cleaned up: one dependable workflow.');
  }
  // Finished at once, without cursors (the visitor left the story while it was messy or being cleaned).
  function settleNow(){ if(window.wvSwarm && window.wvSwarm.settleTidy) window.wvSwarm.settleTidy(); finish(); }
  function navBottom(){ return nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0; }

  // One cursor job per chip: grab the chip where it lies, drag it onto a workflow step, drop it there (it fades into the step).
  function crewTidy(){
    const swarm = window.wvSwarm;
    if(!swarm || typeof swarm.tidy !== 'function') return false;
    const chips = [...flow.querySelectorAll('.frame-chaos .chip')], steps = [...flow.querySelectorAll('.frame-pipe .pnode')];
    if(!chips.length || !steps.length) return false;
    const centre = r => ({x: r.left + r.width / 2, y: r.top + r.height / 2});
    const goals = steps.map(s => centre(s.getBoundingClientRect()));
    const items = chips.map((chip, i) => {
      const from = centre(chip.getBoundingClientRect()), to = goals[i % goals.length];
      let base = 'none';
      return {
        from: () => from, to: () => to,
        start(){ base = getComputedStyle(chip).transform; chip.style.transition = 'none'; },
        move(dx, dy){ chip.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) ' + (base === 'none' ? '' : base); },
        drop(){ chip.style.transition = ''; chip.style.opacity = '0'; }
      };
    });
    return swarm.tidy(items, finish);
  }

  function startTidy(){
    if(tidy !== 'idle') return;
    tidy = 'run';
    flow.setAttribute('data-tidy','run');
    say('Cleaning up the scattered steps.');
    if(!crewTidy()) finish();       // no crew: the CSS stage change tidies it up
  }

  // A press: the story shrinks to one screen while the stage stays exactly where it is on screen (the page scrolls by the
  // stage's shift, instantly), so the visitor watches the clean-up and the next scroll goes on to the next part. Focus leaves the
  // button, which fades out, for the stage, so keyboard users keep their place and the status line still reads out.
  function press(){
    if(tidy !== 'idle') return;
    if(stage){
      const before = stage.getBoundingClientRect().top;
      flow.setAttribute('data-short','');
      const shift = stage.getBoundingClientRect().top - before;
      if(Math.abs(shift) > 0.5) scrollTo({ top: scrollY + shift, behavior: 'instant' });
      if(btn && document.activeElement === btn){ stage.setAttribute('tabindex','-1'); stage.focus({preventScroll:true}); }
    }
    startTidy();
  }
  if(btn) btn.addEventListener('click', press);

  function update(){
    ticking = false;
    const rect = flow.getBoundingClientRect();
    const total = flow.offsetHeight - window.innerHeight; // sticky scroll distance
    const scrolled = Math.min(Math.max(-rect.top, 0), total);
    const p = total > 0 ? scrolled / total : 1;
    const navB = navBottom(), out = rect.bottom <= navB || rect.top >= window.innerHeight;
    // Left the section while it was still messy or being cleaned (a jump past it): show the clean workflow at once.
    if(out){ if(tidy !== 'done' && (tidy === 'run' || rect.bottom <= navB)) settleNow(); return; }
    if(tidy === 'idle' && p >= 0.3 && !waitRest.matches) startTidy();
  }
  // The page has come to rest: start the clean-up if the visitor stopped a third of the way in or further with the story on
  // screen; a story passed while the page moved is shown clean at once.
  addEventListener('wv-rest', () => {
    if(!waitRest.matches || tidy === 'done') return;
    const rect = flow.getBoundingClientRect(), navB = navBottom();
    if(Math.min(rect.bottom, innerHeight) - Math.max(rect.top, navB) <= 0){ if(tidy === 'run' || rect.bottom <= navB) settleNow(); return; }
    const total = flow.offsetHeight - innerHeight, p = total > 0 ? Math.min(Math.max(-rect.top, 0), total) / total : 1;
    if(tidy === 'idle' && p >= 0.3) startTidy();
  });
  // A visitor who stops in the section without pressing the button: after 6 s at rest the cursors clean it up anyway, so
  // nobody is left looking at the mess.
  let restTimer = 0;
  function restSoon(){ clearTimeout(restTimer); if(tidy === 'idle' && active) restTimer = setTimeout(() => { const r = flow.getBoundingClientRect(); if(r.bottom > 0 && r.top < window.innerHeight) startTidy(); }, 6000); }
  function onScroll(){ restSoon(); if(!ticking){ ticking = true; requestAnimationFrame(update); } }

  // Only listen while the section is near or in the viewport.
  const io = new IntersectionObserver((entries)=>{
    entries.forEach((e)=>{
      if(e.isIntersecting && !active){ active = true; addEventListener('scroll', onScroll, {passive:true}); update(); restSoon(); }
      else if(!e.isIntersecting && active){ active = false; clearTimeout(restTimer); removeEventListener('scroll', onScroll); update(); }
    });
  }, {rootMargin:'200px 0px 200px 0px'});
  io.observe(flow);
})();
