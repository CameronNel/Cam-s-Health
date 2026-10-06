export function createPWA({onchange=()=>{}}={}) {
  const media=matchMedia('(display-mode: standalone)');
  const state={supported:'serviceWorker' in navigator&&window.isSecureContext,standalone:media.matches||navigator.standalone===true,
    installed:false,canInstall:false,ready:false,updateAvailable:false,checkingUpdate:false,updateChecked:false,offline:!navigator.onLine,error:''};
  let prompt=null,registration=null,registrationTask=null,checkingTask=null,activating=false,startRegistration=async()=>{};
  const changed=()=>onchange(state);
  const waiting=()=>{state.updateAvailable=!!registration?.waiting;state.ready=!!registration?.active;changed();};
  const installation=worker=>new Promise((resolve,reject)=>{
    if(!worker)return resolve();
    let timer;
    const finish=()=>{
      if(worker.state==='redundant'){cleanup();reject(Error('App update could not be prepared.'));}
      else if(['installed','activating','activated'].includes(worker.state)){cleanup();resolve();}
    };
    const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('statechange',finish);};
    worker.addEventListener('statechange',finish);
    timer=setTimeout(()=>{cleanup();reject(Error('App update check timed out.'));},45000);
    finish();
  });
  const checkForUpdates=()=>{
    if(checkingTask)return checkingTask;
    checkingTask=Promise.resolve().then(async()=>{
      state.checkingUpdate=true;state.updateChecked=false;state.error='';changed();
      try {
        if(!state.supported)throw Error('App updates need a supported browser and HTTPS.');
        if(!navigator.onLine)throw Error('Reconnect before checking for app updates.');
        await startRegistration();
        if(!registration)throw Error('App update service is unavailable.');
        await registration.update();
        await installation(registration.installing);
        waiting();state.updateChecked=true;
        return state.updateAvailable;
      } catch {
        state.error=!state.supported?'App updates need a supported browser and HTTPS.':navigator.onLine?'App updates could not be checked. Your current app and saved records are intact. Try again when connected.':'Reconnect before checking for app updates. Your saved records are intact.';
        throw Error(state.error);
      } finally {state.checkingUpdate=false;checkingTask=null;changed();}
    });
    return checkingTask;
  };
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
        const watched=new Set();
        const watch=worker=>{
          if(!worker||watched.has(worker))return;watched.add(worker);
          worker.addEventListener('statechange',()=>{if(worker.state==='redundant')state.error=registration.active?'App update could not be prepared. Your current app and saved records are intact. Check for updates to retry.':'Offline files could not be prepared. Reconnect and check for updates to retry.';if(worker.state==='installed'||worker.state==='redundant')waiting();});
        };
        waiting();
        watch(registration.installing);
        registration.addEventListener('updatefound',()=>watch(registration.installing));
        document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine)checkForUpdates().catch(()=>{});});
      } catch {registrationTask=null;state.error='Installation could not be prepared. Reconnect and reload to retry.';changed();}
    };
    const begin=()=>{registrationTask??=register();return registrationTask;};
    startRegistration=begin;
    if(document.readyState==='complete')begin();else window.addEventListener('load',begin,{once:true});
  }
  return {state,
    checkForUpdates,
    async install(){if(!prompt)throw Error('Open Chrome’s menu and choose Install app or Add to Home screen.');const event=prompt;prompt=null;state.canInstall=false;await event.prompt();await event.userChoice;changed();},
    async activateUpdate(){if(!registration?.waiting)throw Error('No update is waiting.');if(state.offline)throw Error('Reconnect before updating.');activating=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});},
  };
}
