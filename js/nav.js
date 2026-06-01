// nav border + scroll progress
const nav=document.getElementById('nav'),bar=document.getElementById('progress');
function onScroll(){
  nav.classList.toggle('scrolled',scrollY>20);
  const h=document.documentElement.scrollHeight-innerHeight;
  bar.style.width=(h>0?(scrollY/h)*100:0)+'%';
}
addEventListener('scroll',onScroll,{passive:true});onScroll();

// scroll-spy: highlight the nav link for the section currently in view (wayfinding)
const spyLinks=[...document.querySelectorAll('.nav-links a:not(.nav-cta)')];
const spyMap=new Map(spyLinks.map(a=>[a.getAttribute('href').slice(1),a]));
const spy=new IntersectionObserver((es)=>{es.forEach((e)=>{
  if(e.isIntersecting){spyLinks.forEach(a=>a.classList.remove('active'));
    const a=spyMap.get(e.target.id);if(a)a.classList.add('active');}
})},{rootMargin:'-45% 0px -50% 0px'});
spyMap.forEach((_,id)=>{const s=document.getElementById(id);if(s)spy.observe(s);});
