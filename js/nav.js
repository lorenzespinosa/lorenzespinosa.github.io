// nav border + scroll progress
const nav=document.getElementById('nav'),bar=document.getElementById('progress');
// The page height is read when the layout changes size, not on every scroll event (a read there forces a layout pass).
let pageH=document.documentElement.scrollHeight;
if('ResizeObserver' in window)new ResizeObserver(()=>{pageH=document.documentElement.scrollHeight;}).observe(document.body);
function onScroll(){
  nav.classList.toggle('scrolled',scrollY>20);
  const h=pageH-innerHeight;
  bar.style.transform='scaleX('+(h>0?scrollY/h:0).toFixed(4)+')'; // transform, not width: no layout on every scroll event
}
addEventListener('scroll',onScroll,{passive:true});onScroll();

// scroll-spy: highlight the nav link for the section currently in view (wayfinding)
const spyLinks=[...document.querySelectorAll('.nav-links > a:not(.nav-cta)')];
const spyMap=new Map(spyLinks.map(a=>[a.getAttribute('href').slice(1),a]));
const spy=new IntersectionObserver((es)=>{es.forEach((e)=>{
  if(e.isIntersecting){spyLinks.forEach(a=>a.classList.remove('active'));
    const a=spyMap.get(e.target.id);if(a)a.classList.add('active');}
})},{rootMargin:'-45% 0px -50% 0px'});
spyMap.forEach((_,id)=>{const s=document.getElementById(id);if(s)spy.observe(s);});

// Close the narrow section menu after navigation, on Escape, or on outside touch/click.
const mobileNav=document.querySelector('.mobile-nav');
if(mobileNav){
  const summary=mobileNav.querySelector('summary');
  mobileNav.querySelectorAll('.mobile-nav-panel a').forEach(a=>a.addEventListener('click',()=>{mobileNav.open=false;}));
  mobileNav.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&mobileNav.open){mobileNav.open=false;summary.focus();}
  });
  document.addEventListener('pointerdown',e=>{
    if(mobileNav.open&&!mobileNav.contains(e.target))mobileNav.open=false;
  });
}
