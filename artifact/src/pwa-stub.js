// An Artifact cannot register a service worker, so the PWA surface is inert here.
export function createPWA() {
  return {
    state: {offline: false, updateAvailable: false, standalone: false, installed: false, canInstall: false, ready: false, supported: false, error: ''},
    install: async () => {}, activateUpdate: async () => {}
  };
}
