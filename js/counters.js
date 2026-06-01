(function(){
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const els=[...document.querySelectorAll('.n[data-count]')];
  const fmt=(el,v)=>(el.dataset.prefix||'')+Math.round(v).toLocaleString()+(el.dataset.suffix||'');
  if(reduce){els.forEach(el=>el.textContent=fmt(el,+el.dataset.count));return;}
  els.forEach((el,i)=>{
    const target=+el.dataset.count,dur=1100,delay=800+i*140,t0=performance.now()+delay;
    (function step(now){
      const k=Math.min(1,Math.max(0,(now-t0)/dur));
      const e=1-Math.pow(1-k,3);                 // easeOutCubic
      el.textContent=fmt(el,target*e);
      if(k<1)requestAnimationFrame(step);
    })(performance.now());
  });
})();
