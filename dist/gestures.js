// A hold previews; ordinary activation opens. Movement always leaves scrolling free.
export function createPressHandlers({open,preview,schedule=setTimeout,unschedule=clearTimeout,now=Date.now,holdMs=450,tolerance=10}) {
  let timer=null, origin=null, suppressUntil=0;
  const cancel=()=>{if(timer!==null)unschedule(timer);timer=null;origin=null;};
  return {
    down(event){cancel();if(event.button!==0||event.isPrimary===false)return;suppressUntil=0;origin={x:event.clientX,y:event.clientY};timer=schedule(()=>{timer=null;origin=null;suppressUntil=Infinity;preview();},holdMs);},
    move(event){if(origin&&Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>tolerance)cancel();},
    up(){cancel();if(suppressUntil===Infinity)suppressUntil=now()+700;},
    cancel,
    click(event){if(event.detail!==0&&now()<suppressUntil){suppressUntil=0;event.preventDefault();event.stopPropagation();return;}cancel();open();},
    context(event){event.preventDefault();}
  };
}

// Intercept only a deliberate two-finger pinch inside the dialog. One-finger
// scrolling and normal page zoom outside the dialog keep their native behavior.
export function createPinchHandlers({expand,collapse,isExpanded,threshold=1.18}) {
  let baseline=null,triggered=false;
  const distance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  const cancel=()=>{baseline=null;triggered=false;};
  return {
    start(event){
      if(event.touches.length!==2){if(event.touches.length>2)cancel();return;}
      if(event.target?.closest?.('input,select,textarea'))return;
      const d=distance(event.touches);if(d<24)return;
      baseline=d;triggered=false;event.preventDefault();
    },
    move(event){
      if(baseline===null||event.touches.length!==2)return;
      event.preventDefault();if(triggered)return;
      const ratio=distance(event.touches)/baseline;
      if(!isExpanded()&&ratio>=threshold){triggered=true;expand();}
      else if(isExpanded()&&ratio<=1/threshold){triggered=true;collapse();}
    },
    end(event){if(event.touches.length<2)cancel();},
    cancel
  };
}
