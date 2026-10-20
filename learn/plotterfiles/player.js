for(const root of document.querySelectorAll('[data-growth-player]')){
 const image=root.querySelector('[data-growth-image]'),button=root.querySelector('[data-growth-play]'),scrub=root.querySelector('[data-growth-scrub]'),counter=root.querySelector('[data-growth-count]');let index=0,timer=null;
 const show=()=>{image.src='../assets/frames/'+String(index).padStart(2,'0')+'.svg';image.alt='Venation growth frame '+(index+1)+' of 12';scrub.value=index;counter.value=(index+1)+' / 12';};
 const pause=()=>{clearInterval(timer);timer=null;button.textContent='Play';};
 button.addEventListener('click',()=>{if(timer){pause();return;}button.textContent='Pause';timer=setInterval(()=>{index=(index+1)%12;show();},250);});
 scrub.addEventListener('input',()=>{pause();index=+scrub.value;show();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
}
