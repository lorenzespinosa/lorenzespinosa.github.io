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

// scroll-spy: lights the link of the last section whose top is above 35% of the screen under the nav (some sections have none)
const spyLinks=[...document.querySelectorAll('.nav-links > a:not(.nav-cta)')];
let spyFrame=0;
function spy(){
  spyFrame=0;
  const line=nav.getBoundingClientRect().bottom+(innerHeight-nav.offsetHeight)*.35;
  let id='';
  document.querySelectorAll('#main > [data-snap]').forEach(s=>{if(s.getClientRects().length&&s.getBoundingClientRect().top<=line)id=s.id;});
  spyLinks.forEach(a=>{const on=a.hash==='#'+id;a.classList.toggle('active',on);on?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current');});
}
addEventListener('scroll',()=>{if(!spyFrame)spyFrame=requestAnimationFrame(spy);},{passive:true});
addEventListener('scrollend',spy);addEventListener('resize',spy);spy();

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
