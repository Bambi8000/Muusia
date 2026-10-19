for(const player of document.querySelectorAll('.craft-player')){
 const picture=player.querySelector('.craft-frame'),play=player.querySelector('[data-play]'),reset=player.querySelector('[data-reset]'),scrub=player.querySelector('[data-scrub]'),counter=player.querySelector('[data-counter]'),fps=player.querySelector('[data-fps]'),fi=player.dataset.lang==='fi';let timer=null;
 const draw=i=>{scrub.value=String(i);picture.src=player.dataset.frames+String(i).padStart(2,'0')+'.svg';counter.textContent=(i+1)+' / 12';picture.alt=(fi?'Animaatioruutu ':'Animation frame ')+(i+1)+' / 12';};
 const stop=()=>{clearInterval(timer);timer=null;play.textContent=fi?'Toista':'Play';play.setAttribute('aria-pressed','false');};
 const start=()=>{stop();play.textContent=fi?'Tauko':'Pause';play.setAttribute('aria-pressed','true');timer=setInterval(()=>draw((+scrub.value+1)%12),1000/Math.max(1,Math.min(24,+fps.value||3)));};
 play.setAttribute('aria-pressed','false');play.addEventListener('click',()=>timer?stop():start());reset.addEventListener('click',()=>{stop();draw(0);});scrub.addEventListener('input',()=>{stop();draw(+scrub.value);});fps.addEventListener('change',()=>{fps.value=String(Math.max(1,Math.min(24,+fps.value||3)));if(timer)start();});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
}
