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
