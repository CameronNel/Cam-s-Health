/** Add small, disposable glass reflections and hover movement to health widgets. */
export function mountWidgetMotion(root) {
  const widgets = [...root.querySelectorAll('.health-widget')];
  if (root.matches?.('.health-widget')) widgets.unshift(root);
  const view = root.ownerDocument?.defaultView || root.defaultView || window;
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = view.matchMedia('(hover: hover) and (pointer: fine)');
  const states = [];
  let observer = null;
  let disposed = false;

  const paint = state => {
    const x = Math.max(0, Math.min(100, state.x));
    const y = Math.max(0, Math.min(100, state.y));
    state.element.style.setProperty('--pointer-x', `${x.toFixed(2)}%`);
    state.element.style.setProperty('--pointer-y', `${y.toFixed(2)}%`);
    state.element.style.setProperty('--tilt-x', `${((50 - y) * 0.045).toFixed(3)}deg`);
    state.element.style.setProperty('--tilt-y', `${((x - 50) * 0.055).toFixed(3)}deg`);
  };

  const reset = state => {
    if (state.frame) view.cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.lastTime = 0;
    state.x = state.y = state.targetX = state.targetY = 50;
    state.vx = state.vy = 0;
    state.element.classList.remove('is-pressed');
    paint(state);
  };

  const animate = state => {
    if (state.frame || disposed) return;
    const tick = time => {
      state.frame = 0;
      const dt = state.lastTime ? Math.min(2, (time - state.lastTime) / 16.667) : 1;
      state.lastTime = time;
      const damping = Math.pow(0.63, dt);
      state.vx = (state.vx + (state.targetX - state.x) * 0.14 * dt) * damping;
      state.vy = (state.vy + (state.targetY - state.y) * 0.14 * dt) * damping;
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      const resting = Math.abs(state.targetX - state.x) + Math.abs(state.targetY - state.y)
        + Math.abs(state.vx) + Math.abs(state.vy) < 0.025;
      if (resting) {
        state.x = state.targetX;
        state.y = state.targetY;
        state.vx = state.vy = state.lastTime = 0;
      }
      paint(state);
      if (!resting) state.frame = view.requestAnimationFrame(tick);
    };
    state.frame = view.requestAnimationFrame(tick);
  };

  for (const element of widgets) {
    const state = { element, x: 50, y: 50, targetX: 50, targetY: 50, vx: 0, vy: 0, frame: 0, lastTime: 0 };
    const move = event => {
      if (reducedMotion.matches || !finePointer.matches || event.pointerType !== 'mouse' || event.buttons) return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      state.targetX = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
      state.targetY = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
      animate(state);
    };
    const leave = () => {
      element.classList.remove('is-pressed');
      state.targetX = state.targetY = 50;
      if (reducedMotion.matches || !finePointer.matches) reset(state);
      else animate(state);
    };
    const press = event => {
      if (!reducedMotion.matches && event.isPrimary && event.button === 0) element.classList.add('is-pressed');
    };
    const release = () => element.classList.remove('is-pressed');
    const listeners = { pointerenter: move, pointermove: move, pointerleave: leave, pointerdown: press, pointerup: release, pointercancel: leave };
    for (const [name, listener] of Object.entries(listeners)) element.addEventListener(name, listener, { passive: true });
    state.removeListeners = () => {
      for (const [name, listener] of Object.entries(listeners)) element.removeEventListener(name, listener);
    };
    element.classList.add('motion-ready');
    paint(state);
    states.push(state);
  }

  if (!reducedMotion.matches && view.IntersectionObserver) {
    try {
      observer = new view.IntersectionObserver(entries => {
        if (disposed) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }, { threshold: 0.08, rootMargin: '24px' });
      for (const element of widgets) observer.observe(element);
    } catch {
      observer?.disconnect();
      observer = null;
    }
  }
  if (!observer) for (const element of widgets) element.classList.add('is-visible');

  const preferenceChanged = () => {
    if (reducedMotion.matches || !finePointer.matches) for (const state of states) reset(state);
    if (reducedMotion.matches) {
      observer?.disconnect();
      for (const element of widgets) element.classList.add('is-visible');
    }
  };
  const watch = media => {
    if (media.addEventListener) {
      media.addEventListener('change', preferenceChanged);
      return () => media.removeEventListener('change', preferenceChanged);
    }
    media.addListener(preferenceChanged);
    return () => media.removeListener(preferenceChanged);
  };
  const unwatchReduced = watch(reducedMotion);
  const unwatchPointer = watch(finePointer);

  return () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    unwatchReduced();
    unwatchPointer();
    for (const state of states) {
      reset(state);
      state.removeListeners();
      state.element.classList.remove('motion-ready', 'is-visible');
      for (const name of ['--pointer-x', '--pointer-y', '--tilt-x', '--tilt-y']) state.element.style.removeProperty(name);
    }
  };
}
