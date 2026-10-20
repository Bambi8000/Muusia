for(const root of document.querySelectorAll('[data-study-player]')){
 const image=root.querySelector('img'),button=root.querySelector('button'),scrub=root.querySelector('input'),counter=root.querySelector('output'),count=+root.dataset.frames,id=root.dataset.studyPlayer;let index=0,timer=null;
 const show=()=>{image.src='../assets/frames/'+id+'/'+String(index).padStart(2,'0')+'.svg';image.alt=id+' frame '+(index+1)+' of '+count;scrub.value=index;counter.value=(index+1)+' / '+count;};
 const pause=()=>{clearInterval(timer);timer=null;button.textContent='Play';};
 button.addEventListener('click',()=>{if(timer){pause();return;}button.textContent='Pause';timer=setInterval(()=>{index=(index+1)%count;show();},300);});
 scrub.addEventListener('input',()=>{pause();index=+scrub.value;show();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
}
