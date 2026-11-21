// The flow scene plays once in view. Replay uses the same cursor job without moving the page.
(function(){
  const flow = document.getElementById('flow');
  if(!flow) return;
  const btn = document.getElementById('flowTidy'), status = document.getElementById('flowStatus'), caption = flow.querySelector('.scrolly-cap');
  const reduce = matchMedia('(prefers-reduced-motion:reduce)');
  let tidy = 'idle', played = false, sayTimer = 0, replayFocused = false;

  function say(text){
    if(!status) return;
    status.textContent = text;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { status.textContent = ''; }, 4000);
  }
  function finish(announce = true){
    tidy = 'done';
    flow.setAttribute('data-tidy','done');
    flow.setAttribute('data-stage','2');
    if(btn){ btn.removeAttribute('aria-disabled'); btn.textContent = 'Replay'; }
    if(announce) say('Cleaned up: one dependable workflow.');
  }
  function crewTidy(){
    const swarm = window.wvSwarm;
    if(!swarm || typeof swarm.tidy !== 'function') return false;
    const chips = [...flow.querySelectorAll('.frame-chaos .chip')], steps = [...flow.querySelectorAll('.frame-pipe .pnode')];
    if(!chips.length || !steps.length) return false;
    const centre = r => ({x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY});
    const items = chips.map((chip, i) => {
      let base = 'none';
      return {
        from: () => centre(chip.getBoundingClientRect()),
        to: () => centre(steps[i % steps.length].getBoundingClientRect()),
        start(){ base = getComputedStyle(chip).transform; chip.style.transition = 'none'; },
        move(dx, dy){ chip.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) ' + (base === 'none' ? '' : base); },
        drop(){ chip.style.transition = ''; chip.style.opacity = '0'; }
      };
    });
    return swarm.tidy(items, finish);
  }
  function start(){
    if(tidy === 'run' || reduce.matches) return;
    tidy = 'run';
    flow.setAttribute('data-tidy','run');
    flow.setAttribute('data-stage','0');
    if(btn) btn.setAttribute('aria-disabled','true');
    say('Cleaning up the scattered steps.');
    if(!crewTidy()) finish();
  }
  function press(){
    if(tidy === 'run' || reduce.matches) return;
    if(tidy === 'done'){
      flow.querySelectorAll('.frame-chaos .chip').forEach(chip => {
        chip.style.transition = 'none'; chip.style.opacity = ''; chip.style.transform = '';
      });
      flow.setAttribute('data-stage','0');
      flow.setAttribute('data-tidy','idle');
      void flow.offsetHeight;
      flow.querySelectorAll('.frame-chaos .chip').forEach(chip => { chip.style.transition = ''; });
      tidy = 'idle';
      if(btn) btn.textContent = 'Clean it up';
    }
    start();
  }
  if(btn) btn.addEventListener('click', press);
  document.addEventListener('focusin', event => { replayFocused = event.target === btn; });
  document.addEventListener('focusout', event => {
    if(event.target === btn && !reduce.matches) replayFocused = false;
  });
  function syncMotion(){
    if(!reduce.matches) return;
    const moveFocus = replayFocused;
    if(window.wvSwarm) window.wvSwarm.settleTidy();
    finish(false);
    if(moveFocus && caption){
      caption.focus({preventScroll:true});
      caption.scrollIntoView({block:'nearest'});
    }
  }
  reduce.addEventListener('change', syncMotion);
  if(reduce.matches){ syncMotion(); return; }
  flow.setAttribute('data-stage','0');
  flow.setAttribute('data-tidy','idle');
  if(!window.IntersectionObserver) return;
  const observer = new IntersectionObserver(entries => {
    if(played || !entries.some(entry => entry.isIntersecting)) return;
    played = true;
    observer.disconnect();
    start();
  }, { threshold: 0.35 });
  observer.observe(flow.querySelector('.flow-viz'));
})();
