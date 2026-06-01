// ROI calculator: the headline number is a live "cost of doing nothing" meter.
// It animates up when the sliders change, then keeps bleeding in real time (cents
// ticking) once the calculator scrolls into view, so the loss is visibly climbing.
(function(){
  const h=document.getElementById('cHours'),r=document.getElementById('cRate'),proc=document.getElementById('cProc'),per=document.getElementById('cPeriod');
  if(!h)return;
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const big=document.getElementById('cBig');
  const CALENDAR_SECONDS_PER_YEAR=365*24*3600;   // 24/7 accrual, never pauses
  let processes=3,period='yearly',yearly=0;
  // base = the period projection (target); baseShown eases toward it; accrued bleeds live
  let base=0,baseShown=0,baseFrom=0,baseT0=0,accrued=0;
  const dur=650;
  const moneyInt=n=>'$'+Math.round(n).toLocaleString();
  const money2=n=>'$'+n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  function render(){big.textContent=reduce?moneyInt(baseShown):money2(baseShown+accrued);}

  function recompute(){
    const hours=+h.value,rate=+r.value;
    document.getElementById('cHoursV').textContent=hours+'h';
    document.getElementById('cRateV').textContent='$'+rate;
    const totalHours=hours*processes, weekly=totalHours*rate;
    yearly=weekly*52;
    base=period==='weekly'?weekly:period==='monthly'?weekly*4.33:yearly;
    baseFrom=baseShown; baseT0=performance.now();   // animate from current shown value to new base
    document.getElementById('cPeriodLbl').textContent=period;
    document.getElementById('cFte').textContent=(totalHours/40).toFixed(1)+'x FTE';
    document.getElementById('c5').textContent=moneyInt(yearly*5);
    if(reduce){baseShown=base;render();}
  }

  h.addEventListener('input',recompute);r.addEventListener('input',recompute);
  proc.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;processes=+b.dataset.v;[...proc.children].forEach(x=>x.classList.toggle('on',x===b));recompute();});
  per.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;period=b.dataset.p;[...per.children].forEach(x=>x.classList.toggle('on',x===b));recompute();});
  recompute();

  if(reduce){baseShown=base;render();return;}

  // single rAF loop: eases the base on change AND bleeds the cents in real time once visible
  let last=null,visible=false;
  (function frame(now){
    if(last==null)last=now;
    const dt=(now-last)/1000; last=now;
    const k=Math.min(1,(now-baseT0)/dur),e=1-Math.pow(1-k,3);
    baseShown=baseFrom+(base-baseFrom)*e;
    if(visible) accrued+=(yearly/CALENDAR_SECONDS_PER_YEAR)*dt;
    render();
    requestAnimationFrame(frame);
  })(performance.now());
  // replay the spring-up from $0 each time the calculator (re)enters view, then bleed 24/7
  new IntersectionObserver((es)=>{es.forEach(x=>{
    if(x.isIntersecting){
      if(!visible){baseFrom=0;baseShown=0;baseT0=performance.now();accrued=0;}
      visible=true;
    }else visible=false;
  });},{threshold:0.35}).observe(document.getElementById('roi'));
})();
