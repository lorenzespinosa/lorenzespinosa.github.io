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

// ── ROI scenario comparison (storage key: roi-scenarios-v1) ────────
// Up to three named scenarios saved locally, compared against the first
// saved scenario. Independent from the animated meter above: values are
// computed directly from stored inputs and are never animated.
(function(){
  const root=document.getElementById('scnRegion');
  if(!root)return;
  const byId=id=>document.getElementById(id);
  const nameI=byId('sName'),hoursI=byId('sHours'),procI=byId('sProc'),rateI=byId('sRate');
  const saveB=byId('sSave'),updateB=byId('sUpdate'),cancelB=byId('sCancel'),exportB=byId('sExport');
  const statusEl=byId('sStatus'),tbody=byId('scnBody'),countEl=byId('scnCount');
  const KEY='roi-scenarios-v1',MAX=3;
  const money2=n=>'$'+n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const hoursFmt=n=>(Math.round(n*100)/100).toLocaleString()+' h';
  let scenarios=[],editingId=null;

  function say(msg){statusEl.classList.remove('scn-error');statusEl.textContent=msg;}
  function warn(msg,el){
    statusEl.textContent=msg;statusEl.classList.add('scn-error');
    if(el){el.setAttribute('aria-invalid','true');el.focus();}
  }
  function clearErr(){
    statusEl.classList.remove('scn-error');
    [nameI,hoursI,procI,rateI].forEach(i=>i.removeAttribute('aria-invalid'));
  }

  function uid(){
    let id;
    do{id='scn-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
    while(scenarios.some(s=>s.id===id));
    return id;
  }

  // localStorage guarded: private mode, quota and security errors never break the page
  function storeRead(){try{return localStorage.getItem(KEY);}catch(e){return null;}}
  function storeWrite(v){try{localStorage.setItem(KEY,v);return true;}catch(e){return false;}}

  // Accept only clean plain data; reject malformed payloads without throwing
  function sanitizeList(data){
    if(!Array.isArray(data)||data.length>MAX)return null;
    const seen=new Set(),out=[];
    for(const it of data){
      if(!it||typeof it!=='object'||Array.isArray(it))return null;
      const id=typeof it.id==='string'?it.id.trim():'';
      if(!id||seen.has(id))return null;
      seen.add(id);
      const name=(typeof it.name==='string'?it.name:'').trim().slice(0,80);
      const num=f=>{
        if(typeof f==='number')return f;
        if(typeof f==='string'&&/^[+-]?(\d+\.?\d*|\.\d+)$/.test(f.trim()))return Number(f);
        return NaN;
      };
      const h=num(it.hoursPerProcessPerWeek),p=num(it.processCount),r=num(it.hourlyRate);
      if(!Number.isFinite(h)||h<1||h>40)return null;
      if(!Number.isFinite(p)||!Number.isInteger(p)||p<1||p>10)return null;
      if(!Number.isFinite(r)||r<10||r>200)return null;
      out.push({id:id,name:name,hoursPerProcessPerWeek:Math.round(h*100)/100,processCount:p,hourlyRate:Math.round(r*100)/100});
    }
    return out;
  }

  function load(){
    let raw;
    try{raw=localStorage.getItem(KEY);}catch(e){raw=null;}
    if(raw===null)return;                       // nothing stored, or storage unavailable
    let data=null;
    try{data=JSON.parse(raw);}catch(e){data=null;}
    const list=sanitizeList(data);
    if(list===null){
      say('Saved scenarios could not be read, so the comparison started empty. Nothing else on this page was changed.');
      return;
    }
    scenarios=list;
  }

  function persist(){
    const ok=storeWrite(JSON.stringify(scenarios));
    if(!ok)say('This browser blocked local storage, so the scenarios are available for this visit only and were not saved.');
    return ok;
  }

  function compute(s){
    const weeklyHours=s.hoursPerProcessPerWeek*s.processCount;
    const weekly=weeklyHours*s.hourlyRate;
    return{weeklyHours:weeklyHours,weekly:weekly,monthly:weekly*4.33,yearly:weekly*52};
  }

  function syncForm(){
    const editing=scenarios.find(s=>s.id===editingId);
    if(editing){editingId=editing.id;saveB.hidden=true;updateB.hidden=false;cancelB.hidden=false;}
    else{editingId=null;saveB.hidden=false;updateB.hidden=true;cancelB.hidden=true;}
  }

  function render(){
    tbody.textContent='';
    if(!scenarios.length){
      const tr=document.createElement('tr');tr.className='scn-empty';
      const td=document.createElement('td');td.colSpan=7;
      td.textContent='No scenarios saved yet. Fill the fields above and choose Save scenario to start comparing.';
      tr.appendChild(td);tbody.appendChild(tr);
    }else{
      const ref=compute(scenarios[0]).yearly;   // difference reference: first saved scenario
      scenarios.forEach(s=>{
        const c=compute(s),diff=c.yearly-ref;
        const diffTxt=diff===0?'$0.00':(diff>0?'+':'-')+money2(Math.abs(diff));
        const tr=document.createElement('tr');tr.dataset.id=s.id;
        const vals=[s.name,hoursFmt(c.weeklyHours),money2(c.weekly),money2(c.monthly),money2(c.yearly),diffTxt];
        vals.forEach((v,i)=>{const td=document.createElement('td');td.dataset.col=String(i);td.textContent=v;tr.appendChild(td);});
        const act=document.createElement('td');
        const eb=document.createElement('button');eb.type='button';eb.className='scn-act';eb.dataset.act='edit';eb.textContent='Edit '+s.name;
        const rb=document.createElement('button');rb.type='button';rb.className='scn-act scn-act-del';rb.dataset.act='remove';rb.textContent='Remove '+s.name;
        act.appendChild(eb);act.appendChild(rb);tr.appendChild(act);
        tbody.appendChild(tr);
      });
    }
    countEl.textContent=scenarios.length?('Scenarios saved: '+scenarios.length+' of '+MAX):'';
    syncForm();
  }

  function readForm(){
    const name=(nameI.value||'').trim().slice(0,80);
    if(!name){warn('Enter a scenario name (1 to 80 characters).',nameI);return null;}
    const parse=v=>{
      const t=(v||'').trim();
      if(!t||!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t))return NaN;
      const n=Number(t);
      return Number.isFinite(n)?n:NaN;
    };
    const h=parse(hoursI.value);
    if(!Number.isFinite(h)||h<1||h>40){warn('Hours per process each week must be a finite number from 1 to 40. Fractions are allowed.',hoursI);return null;}
    const p=parse(procI.value);
    if(!Number.isFinite(p)||!Number.isInteger(p)||p<1||p>10){warn('Process count must be a whole number from 1 to 10.',procI);return null;}
    const r=parse(rateI.value);
    if(!Number.isFinite(r)||r<10||r>200){warn('Loaded cost per hour must be a finite number from 10 to 200. Cents are allowed.',rateI);return null;}
    return{name:name,hoursPerProcessPerWeek:Math.round(h*100)/100,processCount:p,hourlyRate:Math.round(r*100)/100};
  }

  function saveScenario(){
    clearErr();
    if(!editingId&&scenarios.length>=MAX){
      warn('Only three scenarios can be saved. Remove one, or choose Edit to change an existing scenario.');
      return;
    }
    const data=readForm();
    if(!data)return;
    if(editingId){
      const s=scenarios.find(x=>x.id===editingId);
      if(!s){editingId=null;syncForm();return;}
      s.name=data.name;s.hoursPerProcessPerWeek=data.hoursPerProcessPerWeek;s.processCount=data.processCount;s.hourlyRate=data.hourlyRate;
      editingId=null;render();
      if(persist())say('Updated scenario "'+data.name+'".');
    }else{
      const s={id:uid(),name:data.name,hoursPerProcessPerWeek:data.hoursPerProcessPerWeek,processCount:data.processCount,hourlyRate:data.hourlyRate};
      scenarios.push(s);render();
      if(persist())say('Saved scenario "'+s.name+'". It is compared against the first saved scenario.');
    }
  }

  function startEdit(id){
    const s=scenarios.find(x=>x.id===id);
    if(!s)return;
    editingId=id;
    nameI.value=s.name;
    hoursI.value=String(s.hoursPerProcessPerWeek);
    procI.value=String(s.processCount);
    rateI.value=String(s.hourlyRate);
    clearErr();syncForm();
    say('Editing "'+s.name+'". Change the values, then choose Update scenario.');
    nameI.focus();
  }

  function removeScenario(id){
    const i=scenarios.findIndex(s=>s.id===id);
    if(i<0)return;
    const name=scenarios[i].name;
    scenarios.splice(i,1);
    if(editingId===id)editingId=null;
    render();
    if(persist())say('Removed scenario "'+name+'".');
    // sensible focus after removal: next row's Edit button, or the Save button when empty
    const rows=tbody.querySelectorAll('tr[data-id]');
    if(!rows.length){saveB.focus();return;}
    const next=rows[Math.min(i,rows.length-1)];
    const btn=next.querySelector('button[data-act="edit"]');
    if(btn)btn.focus();
  }

  function exportScenarios(){
    if(!scenarios.length){warn('Nothing to export yet. Save a scenario first.');return;}
    const payload={version:1,scenarios:scenarios.map(s=>({id:s.id,name:s.name,hoursPerProcessPerWeek:s.hoursPerProcessPerWeek,processCount:s.processCount,hourlyRate:s.hourlyRate}))};
    let url;
    try{url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}));}
    catch(e){warn('Export is unavailable because this browser blocked the download area.');return;}
    const a=document.createElement('a');
    a.href=url;a.download='roi-scenarios.json';
    a.setAttribute('aria-hidden','true');
    a.style.position='fixed';a.style.left='-9999px';
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove();},2000);
    say('Exported '+scenarios.length+' '+(scenarios.length===1?'scenario':'scenarios')+' as JSON (version 1).');
  }

  saveB.addEventListener('click',saveScenario);
  updateB.addEventListener('click',saveScenario);
  cancelB.addEventListener('click',function(){editingId=null;clearErr();syncForm();say('Edit cancelled. The values stay in the fields; choose Save scenario to save them as a new scenario.');nameI.focus();});
  exportB.addEventListener('click',exportScenarios);
  [nameI,hoursI,procI,rateI].forEach(i=>i.addEventListener('input',clearErr));
  tbody.addEventListener('click',function(e){
    const b=e.target.closest('button[data-act]');if(!b)return;
    const tr=b.closest('tr[data-id]');if(!tr)return;
    if(b.dataset.act==='edit')startEdit(tr.dataset.id);
    else removeScenario(tr.dataset.id);
  });
  root.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.closest('.scn-form')){e.preventDefault();saveScenario();}
  });

  load();
  render();
})();
