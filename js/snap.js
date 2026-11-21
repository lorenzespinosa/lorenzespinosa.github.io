// Notify build parts as they enter view. Scrolling itself stays native.
(function(){
  const main = document.getElementById('main');
  if(!main) return;
  function rest(){
    try { dispatchEvent(new CustomEvent('wv-rest', { detail: { y: scrollY } })); } catch(e){}
  }
  if(!window.IntersectionObserver){ rest(); return; }
  let frame = 0;
  function visible(){
    frame = 0;
    const nav = document.getElementById('nav');
    const bottom = nav ? nav.getBoundingClientRect().bottom : 0;
    const onScreen = [...main.children].some(el => {
      if(!el.matches('header,section')) return false;
      const r = el.getBoundingClientRect();
      return r.bottom > bottom && r.top < innerHeight;
    });
    if(onScreen) rest();
  }
  function soon(){ if(!frame) frame = requestAnimationFrame(visible); }
  const observer = new IntersectionObserver(entries => {
    if(entries.some(entry => entry.isIntersecting)) soon();
  }, { threshold: [0, 0.1] });
  main.querySelectorAll(':scope > header, :scope > section').forEach(el => observer.observe(el));
  addEventListener('hashchange', soon);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
  soon();
})();
