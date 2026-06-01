// Maps scroll progress through the sticky section to 3 stages (0 chaos →
// 1 transition → 2 clean pipeline). Compositor-friendly: only toggles a
// data-stage attribute; CSS owns all transform/opacity transitions.
(function(){
  const flow = document.getElementById('flow');
  if(!flow) return;

  // Reduced motion: leave base "after" state, collapse handled by CSS. No JS-driven scroll.
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce){ flow.setAttribute('data-stage','2'); return; }

  // Begin the story: chaos-first. (Base CSS = after; this opts into the animated sequence.)
  flow.setAttribute('data-stage','0');

  let ticking = false, active = false, current = -1;

  function update(){
    ticking = false;
    const rect = flow.getBoundingClientRect();
    const total = flow.offsetHeight - window.innerHeight; // sticky scroll distance
    const scrolled = Math.min(Math.max(-rect.top, 0), total);
    const p = total > 0 ? scrolled / total : 1;
    const stage = p < 0.34 ? 0 : (p < 0.67 ? 1 : 2);
    if(stage !== current){ current = stage; flow.setAttribute('data-stage', String(stage)); }
  }
  function onScroll(){ if(!ticking){ ticking = true; requestAnimationFrame(update); } }

  // Only listen while the section is near/in the viewport (perf).
  const io = new IntersectionObserver((entries)=>{
    entries.forEach((e)=>{
      if(e.isIntersecting && !active){ active = true; addEventListener('scroll', onScroll, {passive:true}); update(); }
      else if(!e.isIntersecting && active){ active = false; removeEventListener('scroll', onScroll); }
    });
  }, {rootMargin:'200px 0px 200px 0px'});
  io.observe(flow);
})();
