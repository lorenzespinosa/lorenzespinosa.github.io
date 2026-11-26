// staggered reveal - hero is excluded (it animates on load via CSS)
const io=new IntersectionObserver((es)=>{es.forEach((e)=>{if(e.isIntersecting){
  const sibs=[...e.target.parentElement.querySelectorAll('.reveal')];
  e.target.style.transitionDelay=(Math.min(sibs.indexOf(e.target),5)*0.07)+'s';
  e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
document.querySelectorAll('.reveal').forEach(el=>{if(!el.closest('.hero'))io.observe(el)});
