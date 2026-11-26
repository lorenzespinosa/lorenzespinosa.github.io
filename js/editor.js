// workflow demo: draggable nodes, live wires and a run animation
(function(){
  const canvas=document.getElementById('canvas');if(!canvas)return;
  const svg=document.getElementById('wires'),runBtn=document.getElementById('run');
  const SVGNS='http://www.w3.org/2000/svg';
  const nodes={};canvas.querySelectorAll('.gnode').forEach(n=>nodes[n.dataset.n]=n);
  // Process has two outputs: .out-main (success, to Deliver) and .out-err (error, to Fallback).
  const links=[
    {from:'trigger',  sel:'.io.out',      to:'validate'},
    {from:'validate', sel:'.io.out',      to:'process'},
    {from:'process',  sel:'.io.out-main', to:'deliver'},
    {from:'deliver',  sel:'.io.out',      to:'audit'},
    {from:'process',  sel:'.io.out-err',  to:'fallback', error:true}
  ];
  const paths=links.map(l=>{const p=document.createElementNS(SVGNS,'path');p.setAttribute('class','wire'+(l.error?' err':''));svg.appendChild(p);return p;});
  // a successful run flows only the main path; the error branch stays idle
  const mainOrder=links.map((l,i)=>i).filter(i=>!links[i].error);

  // endpoint: the centre of a connector dot, relative to the canvas
  const center=el=>{const r=el.getBoundingClientRect(),c=canvas.getBoundingClientRect();return {x:r.left-c.left+r.width/2,y:r.top-c.top+r.height/2};};
  const srcDot=l=>center(nodes[l.from].querySelector(l.sel));
  const dstDot=l=>center(nodes[l.to].querySelector('.io.in'));
  const curve=(a,b)=>{const dx=Math.max(40,Math.abs(b.x-a.x)*0.6);return `M${a.x},${a.y} C${a.x+dx},${a.y} ${b.x-dx},${b.y} ${b.x},${b.y}`;};

  // "1 item" badge per main connection; a static "error" tag on the error branch
  const badges=links.map(l=>{const d=document.createElement('span');d.className=l.error?'errlabel':'itembadge';d.setAttribute('aria-hidden','true');d.textContent=l.error?'error':'1 item';canvas.appendChild(d);return d;});

  function draw(){
    links.forEach((l,i)=>{
      const a=srcDot(l),b=dstDot(l);
      paths[i].setAttribute('d',curve(a,b));
      badges[i].style.left=((a.x+b.x)/2)+'px';
      badges[i].style.top=((a.y+b.y)/2)+'px';
    });
  }
  draw();addEventListener('resize',draw);

  // drag
  let drag=null;
  canvas.querySelectorAll('.gnode').forEach(n=>{
    n.addEventListener('pointerdown',e=>{
      n.style.left=n.offsetLeft+'px';n.style.top=n.offsetTop+'px';
      drag={n,sx:e.clientX,sy:e.clientY,ol:n.offsetLeft,ot:n.offsetTop};
      try{n.setPointerCapture(e.pointerId);}catch(_){} e.preventDefault();
    });
    n.addEventListener('pointermove',e=>{
      if(!drag||drag.n!==n)return;
      let l=Math.max(0,Math.min(canvas.clientWidth-n.offsetWidth,drag.ol+e.clientX-drag.sx));
      let t=Math.max(0,Math.min(canvas.clientHeight-n.offsetHeight,drag.ot+e.clientY-drag.sy));
      n.style.left=l+'px';n.style.top=t+'px';draw();
    });
    const end=e=>{if(drag&&drag.n===n){try{n.releasePointerCapture(e.pointerId);}catch(_){} drag=null;}};
    n.addEventListener('pointerup',end);n.addEventListener('pointercancel',end);
  });

  // run (restartable): lights nodes, adds checks and item counts
  const prm=matchMedia('(prefers-reduced-motion:reduce)');  // read live so a mid-session OS toggle is honored
  let runToken=0;
  function clearRun(){
    Object.values(nodes).forEach(n=>n.classList.remove('run','done'));
    paths.forEach(p=>p.classList.remove('run'));
    badges.forEach(b=>b.classList.remove('show'));
    svg.querySelectorAll('.pulse').forEach(c=>c.remove());
  }
  function pulseAlong(path,token,done){
    const len=path.getTotalLength();
    const c=document.createElementNS(SVGNS,'circle');c.setAttribute('r','5.5');c.setAttribute('class','pulse');svg.appendChild(c);
    const t0=performance.now(),dur=600;
    (function step(t){
      if(token!==runToken){c.remove();return;}            // stale run - abort this pulse
      const k=Math.min(1,(t-t0)/dur),p=path.getPointAtLength(len*k);
      c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);
      if(k<1)requestAnimationFrame(step);else{c.remove();done&&done();}
    })(performance.now());
  }
  function run(){
    if(prm.matches)return;
    const my=++runToken;          // invalidate any run already in flight
    clearRun();
    nodes.trigger.classList.add('run');
    let k=0;
    (function next(){
      if(my!==runToken||k>=mainOrder.length)return;
      const li=mainOrder[k],l=links[li],path=paths[li];
      nodes[l.from].classList.add('run');path.classList.add('run');
      pulseAlong(path,my,()=>{
        if(my!==runToken)return;
        nodes[l.from].classList.add('done');          // source node executed
        nodes[l.to].classList.add('run');
        badges[li].classList.add('show');             // an item flowed down this connection
        setTimeout(()=>{if(my===runToken)nodes[l.to].classList.add('done');},260); // target completes
        k++;setTimeout(next,150);
      });
    })();
  }
  runBtn.addEventListener('click',run);
  // runs once when the editor scrolls into view (it is hidden on small screens), not under reduced motion
  if(!prm.matches){
    const ed=document.querySelector('.editor');
    if(ed){
      const io=new IntersectionObserver((entries,obs)=>{
        if(entries[0].isIntersecting){
          obs.unobserve(ed);             // one-shot
          draw();                        // ensure wires are correct on first reveal (rects were 0 while hidden <1024px)
          // while the cursors are still carrying the demo in, wait until it lands
          const host=ed.closest('[data-wv-build]');
          if(host&&host.dataset.wvBuild!=='complete'&&ed.getAttribute('data-wv-hide')!==null&&document.documentElement.classList.contains('wv-construct'))
            ed.addEventListener('wv-landed',()=>{draw();setTimeout(run,600);},{once:true});
          else setTimeout(run,900);      // let the .editor reveal (0.52s) settle before the pass
        }
      },{threshold:0.5});
      io.observe(ed);
    }
  }
})();
