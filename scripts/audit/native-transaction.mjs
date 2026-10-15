/** Hold the shared readback mutex before a short-lived UI action, then capture. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {awaitPaint} from './harness.mjs';
export async function nativeTransaction(cdp,prepare){
 const lock='/workspace/cams-health-layout-audit/.native-capture-lock';let acquired=false;
 while(!acquired){try{await fs.mkdir(lock);await fs.writeFile(path.join(lock,'owner'),String(process.pid));acquired=true;}catch(error){if(error.code!=='EEXIST')throw error;try{const pid=Number(await fs.readFile(path.join(lock,'owner'),'utf8'));try{process.kill(pid,0);}catch{await fs.rm(lock,{recursive:true,force:true});}}catch{}if(!acquired)await new Promise(resolve=>setTimeout(resolve,50));}}
 try{const started=Date.now(),value=await prepare();await awaitPaint(cdp);const png=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true,optimizeForSpeed:true});return{value,png,actionToCaptureMs:Date.now()-started};}finally{await fs.rm(lock,{recursive:true,force:true});}
}
