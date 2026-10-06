export function createPWA({openSheet, toast, render}) {
  let prompt = null, registration = null, applyingUpdate = false;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const redraw = () => { if (!document.querySelector('#sheet')?.open) render(); };
  window.addEventListener('beforeinstallprompt', event => {event.preventDefault();prompt=event;redraw();});
  window.addEventListener('appinstalled', () => {prompt=null;toast('Cam’s Life installed. Open it from your home screen.');redraw();});
  const displayMode=window.matchMedia('(display-mode: standalone)');
  displayMode.addEventListener?.('change', redraw);
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', async () => {
      try {
        registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
        registration.addEventListener('updatefound', () => {
          registration.installing?.addEventListener('statechange', () => {if (registration.waiting) redraw();});
        });
        redraw();
      } catch { /* Installation instructions work without offline support. */ }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {if(applyingUpdate) location.reload();});
  }
  return {
    card() {
      return `<section class="life-card"><span class="eyebrow">ON YOUR PHONE</span><h2>${standalone()?'Cam’s Life is installed':'Install Cam’s Life'}</h2><p class="help">${standalone()?'You’re using the standalone app. Your existing records and connections stay unchanged.':'Add it to your home screen for its own icon and app window. No app store or extra subscription.'}</p><button type="button" class="btn secondary" data-life="install-app">${standalone()?'Installation help':'Add to home screen'}</button>${registration?.waiting?'<p class="help">An app update is ready. Save any unfinished entries before applying it; you may need to reconnect GitHub.</p><button type="button" class="btn secondary" data-life="app-update">Apply app update</button>':''}<p class="help">An internet connection is required for records, Gmail and ChatGPT. Only public app assets and a reconnect screen are cached.</p></section>`;
    },
    async action(name) {
      if (name === 'app-update') {
        if(!registration?.waiting){toast('You’re on the latest available version.');return true;}
        if(!window.confirm('Have you saved or copied unfinished input? Applying this update reloads the app and clears its in-memory GitHub connection.'))return true;
        applyingUpdate=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});return true;
      }
      if(name !== 'install-app') return false;
      if(prompt && !standalone()) {
        const event=prompt;prompt=null;
        try{await event.prompt();const result=await event.userChoice;toast(result.outcome==='accepted'?'Installation accepted. Look for Cam’s Life on your home screen.':'You can install later from Settings.');}catch{toast('Use your browser menu to add Cam’s Life to your home screen.');}
        redraw();return true;
      }
      openSheet('Install Cam’s Life', '<p>Open this site in your phone’s browser while signed into ChatGPT.</p><h3>Android · Chrome</h3><p>Open the ⋮ menu, then choose <b>Install app</b> or <b>Add to Home screen</b>. If the install option is not available yet, reload once or choose the home-screen shortcut.</p><h3>iPhone · Safari</h3><p>Tap Share, then <b>Add to Home Screen</b>. Turn on <b>Open as Web App</b> if offered.</p><p class="help">Launch Cam’s Life from its icon. Some browsers offer a shortcut instead of a standalone app. Private-site sign-in still applies. Offline you’ll see a reconnect screen, not cached private records.</p>');
      return true;
    }
  };
}
