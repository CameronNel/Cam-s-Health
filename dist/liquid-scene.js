/* A small optical sculpture. Progress is supplied by the health model, never inferred here. */
const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main(){ vUv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }
`;

// Small glass surfaces need their own crisp backing store: the fullscreen-quad
// context's MSAA does not antialias the curved shape drawn inside its shader.
export function liquidRenderSize(cssWidth,cssHeight,devicePixelRatio=1){
  const w=Math.max(1,Number(cssWidth)||1),h=Math.max(1,Number(cssHeight)||1);
  const density=Number.isFinite(devicePixelRatio)&&devicePixelRatio>0?devicePixelRatio:1;
  const scale=Math.min(Math.max(2,density*1.25),640/Math.max(w,h));
  return {width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale))};
}

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform float uProgress;
uniform float uEmpty;
const float PI = 3.14159265359;

vec3 localPoint(vec3 p){
  float a = .10 + sin(uTime * .23) * .035;
  float b = -.14 + cos(uTime * .19) * .035;
  p.yz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.yz;
  p.xz = mat2(cos(b), -sin(b), sin(b), cos(b)) * p.xz;
  return p;
}
float surface(vec3 p){
  p = localPoint(p);
  return length(vec2(length(p.xy) - .79, p.z)) - .178;
}
vec3 normalAt(vec3 p){
  const vec2 e = vec2(.0014, 0.);
  return normalize(vec3(surface(p+e.xyy)-surface(p-e.xyy), surface(p+e.yxy)-surface(p-e.yxy), surface(p+e.yyx)-surface(p-e.yyx)));
}
// Soft boxes, a cool horizon and narrow strips give glass something to reflect.
vec3 environment(vec3 d){
  vec3 c = mix(vec3(.065,.065,.09), vec3(.21,.22,.28), smoothstep(-.8,.8,d.y));
  float top = pow(max(dot(d,normalize(vec3(-.5,.9,1.2))),0.), 12.);
  float strip = pow(max(dot(d,normalize(vec3(.7,.30,1.0))),0.), 92.);
  float lower = pow(max(dot(d,normalize(vec3(-.45,-.7,.4))),0.), 32.);
  float mint = pow(max(dot(d,normalize(vec3(-1.,.1,.25))),0.), 11.);
  float rose = pow(max(dot(d,normalize(vec3(.9,-.15,.3))),0.), 20.);
  c += vec3(3.3,3.25,3.6) * top;
  c += vec3(5.0,4.8,4.2) * strip;
  c += vec3(.50,.68,.70) * lower;
  c += vec3(.25,.22,.48) * mint;
  c += vec3(.42,.20,.30) * rose;
  float softbox = smoothstep(.15,.175,d.y) * (1.-smoothstep(.52,.545,d.y)) * smoothstep(.2,.55,d.z);
  float sidebox = (1.-smoothstep(.045,.075,abs(d.x+.68))) * smoothstep(-.65,-.3,d.y) * (1.-smoothstep(.2,.4,d.y)) * smoothstep(-.1,.25,d.z);
  c += vec3(3.8,4.0,3.9) * softbox;
  c += vec3(1.8,1.7,2.3) * sidebox;
  return c;
}
float hitSurface(vec3 ro, vec3 rd){
  float t = 1.9;
  for(int i=0;i<64;i++){
    float s = surface(ro + rd*t);
    if(s < .0009) return t;
    t += max(s * .87, .0006);
    if(t > 4.9) break;
  }
  return -1.;
}
void main(){
  vec2 uv = (vUv-.5) * 2.;
  uv.x *= uResolution.x/uResolution.y;
  vec3 ro = vec3(0.,0.,3.35);
  vec3 rd = normalize(vec3(uv * 1.075,-3.35));
  float hit = hitSurface(ro,rd);
  if(hit < 0.){ gl_FragColor = vec4(0.); return; }
  vec3 p = ro + rd*hit;
  vec3 n = normalAt(p);
  float facing = clamp(dot(-rd,n),0.,1.);
  float fresnel = .045 + .955 * pow(1.-facing,4.);
  vec3 reflection = reflect(rd,n);
  vec3 rayInside = refract(rd,n,1./1.46);
  vec3 exitPoint = p + rayInside*.009;
  float depth = .009;
  for(int i=0;i<28;i++){
    float s = surface(exitPoint);
    if(s > -.0007) break;
    float stepSize = max(-s*.87,.001);
    exitPoint += rayInside * stepSize;
    depth += stepSize;
  }
  vec3 exitNormal = normalAt(exitPoint);
  vec3 transmittedRay = refract(rayInside,-exitNormal,1.46);
  if(length(transmittedRay) < .01) transmittedRay = reflect(rayInside,-exitNormal);
  vec3 reflected = environment(reflection);
  vec3 transmission = environment(transmittedRay);
  vec3 q = localPoint(p);
  float angle = mod(atan(q.x,q.y) + PI*2., PI*2.)/(PI*2.);
  float illuminated = (1. - smoothstep(uProgress-.004,uProgress+.004,angle)) * (1.-uEmpty);
  illuminated *= step(.0001,uProgress);
  vec3 tint = mix(vec3(.84,.85,.94),vec3(.72,.65,1.),illuminated);
  vec3 absorption = exp(-depth*mix(vec3(.30,.28,.22),vec3(.25,.35,.08),illuminated));
  vec3 glass = transmission*absorption*.20 + tint*.02;
  // Fine spectral separation is restricted to grazing light rather than a rainbow fill.
  vec3 spectral = .5 + .5*cos(vec3(0.,2.1,4.2)+facing*14.+q.y*1.5);
  glass = mix(glass,reflected,clamp(fresnel*.85+.14,0.,1.));
  glass += spectral * pow(1.-facing,2.) * .075;
  glass += tint*illuminated*pow(1.-facing,1.6)*.32;
  glass += vec3(.20,.13,.58)*illuminated*pow(1.-facing,2.5)*.55;
  float spec = pow(max(dot(reflection,normalize(vec3(-.4,.85,1.3))),0.),155.);
  float edge = pow(1.-facing,4.);
  glass += vec3(.92,1.,.98) * spec*1.5;
  glass += vec3(.84,.83,1.)*edge*.78;
  glass = glass/(glass+vec3(.46));
  glass = pow(glass,vec3(.80));
  float reflectedLight = dot(reflected,vec3(.2126,.7152,.0722));
  float opacity = clamp(.045+fresnel*.68+reflectedLight*.20+illuminated*(.018+pow(1.-facing,2.)*.18),.045,.96);
  // A subpixel coverage ramp removes the hard ray-hit staircase along both
  // curved rims. The backing store also supersamples narrow reflected lights.
  float pixelFootprint = 2.15 * hit / (3.35 * uResolution.y);
  float edgeCoverage = smoothstep(0.,sqrt(pixelFootprint/.178),facing);
  gl_FragColor = vec4(glass,opacity*edgeCoverage);
}
`;

function makeRenderer(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: true, premultipliedAlpha: false,
    depth: false, stencil: false, preserveDrawingBuffer: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;
  const shaders = [];
  let program;
  let buffer;
  try {
    for (const [kind, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
      const shader = gl.createShader(kind);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    }
    program = gl.createProgram();
    shaders.forEach(shader => gl.attachShader(program, shader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const uniforms = Object.fromEntries(['uResolution','uTime','uProgress','uEmpty'].map(name => [name,gl.getUniformLocation(program,name)]));
    gl.clearColor(0,0,0,0);
    const dispose = () => {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach(shader => gl.deleteShader(shader));
    };
    return {
      gl,
      draw(time) {
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.useProgram(program);
        const raw = Number.parseFloat(canvas.dataset.progress);
        const progress = Number.isFinite(raw) ? Math.max(0,Math.min(1,raw)) : 0;
        const empty = canvas.dataset.empty === 'true' || !Number.isFinite(raw);
        gl.uniform2f(uniforms.uResolution,canvas.width,canvas.height);
        gl.uniform1f(uniforms.uTime,time);
        gl.uniform1f(uniforms.uProgress,progress);
        gl.uniform1f(uniforms.uEmpty,empty ? 1 : 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES,0,6);
      },
      dispose,
    };
  } catch {
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
    return null;
  }
}

function mountScene(canvas) {
  let renderer;
  try { renderer = makeRenderer(canvas); } catch { renderer = null; }
  if (!renderer) {
    canvas.classList.add('liquid-scene-fallback');
    return () => canvas.classList.remove('liquid-scene-fallback');
  }
  const doc = canvas.ownerDocument;
  const win = doc.defaultView || window;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let visible = true;
  let frame = 0;
  let lastDraw = -Infinity;
  let lost = false;
  const started = performance.now();
  const stop = () => { if (frame) win.cancelAnimationFrame(frame); frame = 0; };
  const shouldAnimate = () => !disposed && !lost && visible && !doc.hidden && !motion.matches;
  const render = time => {
    frame = 0;
    if (!shouldAnimate()) return;
    if (time-lastDraw >= 1000/30) {
      renderer.draw((time-started)/1000);
      lastDraw = time;
    }
    frame = win.requestAnimationFrame(render);
  };
  const refresh = () => {
    stop();
    if (disposed || lost || !visible || doc.hidden || !canvas.width || !canvas.height) return;
    renderer.draw(motion.matches ? 0 : (performance.now()-started)/1000);
    lastDraw = performance.now();
    if (shouldAnimate()) frame = win.requestAnimationFrame(render);
  };
  const resize = () => {
    // FLIP/press transforms change the visual box, never the drawing-buffer aspect.
    const {width,height}=liquidRenderSize(canvas.clientWidth,canvas.clientHeight,win.devicePixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    refresh();
  };
  const sizeObserver = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
  if (sizeObserver) sizeObserver.observe(canvas);
  // Pixel density can change without a change in CSS dimensions.
  win.addEventListener('resize',resize,{passive:true});
  const mutationObserver = new win.MutationObserver(refresh);
  mutationObserver.observe(canvas,{attributes:true,attributeFilter:['data-progress','data-empty']});
  const intersectionObserver = win.IntersectionObserver ? new win.IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    refresh();
  },{threshold:0}) : null;
  intersectionObserver?.observe(canvas);
  const contextLost = event => {
    event.preventDefault();
    lost = true;
    stop();
    canvas.classList.add('liquid-scene-fallback');
  };
  const contextRestored = () => {
    renderer?.dispose();
    renderer = makeRenderer(canvas);
    lost = !renderer;
    canvas.classList.toggle('liquid-scene-fallback',lost);
    if (!lost) resize();
  };
  canvas.addEventListener('webglcontextlost',contextLost);
  canvas.addEventListener('webglcontextrestored',contextRestored);
  doc.addEventListener('visibilitychange',refresh);
  if (motion.addEventListener) motion.addEventListener('change',refresh);
  else motion.addListener(refresh);
  resize();
  return () => {
    disposed = true;
    stop();
    sizeObserver?.disconnect();
    mutationObserver.disconnect();
    intersectionObserver?.disconnect();
    win.removeEventListener('resize',resize);
    canvas.removeEventListener('webglcontextlost',contextLost);
    canvas.removeEventListener('webglcontextrestored',contextRestored);
    doc.removeEventListener('visibilitychange',refresh);
    if (motion.removeEventListener) motion.removeEventListener('change',refresh);
    else motion.removeListener(refresh);
    renderer?.dispose();
    canvas.classList.remove('liquid-scene-fallback');
  };
}

/** Mount decorative transparent glass canvases. Call the returned function before replacing the DOM. */
export function mountLiquidScenes(root = document) {
  const canvases = [...root.querySelectorAll('canvas[data-liquid-scene]')];
  if (root.matches?.('canvas[data-liquid-scene]')) canvases.unshift(root);
  const cleanups = canvases.map(mountScene);
  return () => cleanups.forEach(cleanup => cleanup());
}
