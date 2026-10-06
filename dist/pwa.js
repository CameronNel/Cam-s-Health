export function createPWA({onchange=()=>{}}={}) {
  const media=matchMedia('(display-mode: standalone)');
  const state={supported:'serviceWorker' in navigator&&window.isSecureContext,standalone:media.matches||navigator.standalone===true,
    installed:false,canInstall:false,ready:false,updateAvailable:false,offline:!navigator.onLine,error:''};
  let prompt=null,registration=null,activating=false;
  const changed=()=>onchange(state);
  const update=()=>{state.standalone=media.matches||navigator.standalone===true;changed();};
  media.addEventListener('change',update);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;state.canInstall=true;changed();});
  window.addEventListener('appinstalled',()=>{prompt=null;state.canInstall=false;state.installed=true;changed();});
  for(const event of ['online','offline'])window.addEventListener(event,()=>{state.offline=!navigator.onLine;changed();});
  if(state.supported) {
    navigator.serviceWorker.addEventListener('controllerchange',()=>{state.ready=true;state.updateAvailable=false;if(activating)location.reload();else changed();});
    const register=async()=>{
      try {
        registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
        const waiting=()=>{state.updateAvailable=!!registration.waiting;state.ready=!!registration.active;changed();};
        const watched=new Set();
        const watch=worker=>{
          if(!worker||watched.has(worker))return;watched.add(worker);
          worker.addEventListener('statechange',()=>{if(worker.state==='redundant'&&!registration.active)state.error='Offline files could not be prepared. Reconnect and reload to retry.';if(worker.state==='installed'||worker.state==='redundant')waiting();});
        };
        waiting();
        watch(registration.installing);
        registration.addEventListener('updatefound',()=>watch(registration.installing));
        document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine)registration.update().then(()=>{watch(registration.installing);waiting();}).catch(()=>{});});
      } catch {state.error='Installation could not be prepared. Reconnect and reload to retry.';changed();}
    };
    if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
  }
  return {state,
    async install(){if(!prompt)throw Error('Open Chrome’s menu and choose Install app or Add to Home screen.');const event=prompt;prompt=null;state.canInstall=false;await event.prompt();await event.userChoice;changed();},
    async activateUpdate(){if(!registration?.waiting)throw Error('No update is waiting.');if(state.offline)throw Error('Reconnect before updating.');activating=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});},
  };
}
