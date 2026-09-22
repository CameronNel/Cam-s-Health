import {REPO,DATA_PATH} from './model.js';
import {validateHealth} from './body.js';
export const API=`https://api.github.com/repos/${REPO}/contents/${DATA_PATH}`;
export const RAW=`https://raw.githubusercontent.com/${REPO}/main/${DATA_PATH}`;
const CACHE='cams-health-cache';
const decode=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)));
const encode=s=>{let out='';for(const byte of new TextEncoder().encode(s))out+=String.fromCharCode(byte);return btoa(out);};
function checked(data){try{return validateHealth(data);}catch(e){e.kind='schema';throw e;}}
export class GitHubStore {
  #token='';
  constructor({fetcher=globalThis.fetch,storage=globalThis.localStorage,onchange=()=>{}}={}) {
    this.fetcher=fetcher;this.storage=storage;this.onchange=onchange;this.data=null;this.busy=false;this.reading=false;
    this.status='Connecting';this.error='';this.checkedAt=null;this.sha=null;this.account=null;this.lastCommit=null;
  }
  get connected(){return !!this.#token;}
  notify(){this.onchange(this);}
  headers(){const h={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(this.#token)h.Authorization=`Bearer ${this.#token}`;return h;}
  async request(url,options={}) {
    const response=await this.fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(15000),...options});
    if(!response.ok){const e=Error(response.status===401?'GitHub authorization expired or was rejected. Reconnect your token.':response.status===403?'GitHub refused this request. Check Contents permission and the request limit.':response.status===404?'The repository or file was not accessible.':`GitHub request failed (${response.status}).`);e.status=response.status;throw e;}
    return response;
  }
  async apiRead(ref='main') {
    const file=await (await this.request(`${API}?ref=${encodeURIComponent(ref)}&t=${Date.now()}`,{headers:this.headers()})).json();
    if(!file.content||!file.sha)throw Error('GitHub returned an incomplete file response.');
    let parsed;try{parsed=JSON.parse(decode(file.content));}catch{const e=Error('GitHub health.json is not valid JSON.');e.kind='schema';throw e;}
    return {data:checked(parsed),sha:file.sha};
  }
  async remoteRead() {
    if(this.connected)return this.apiRead();
    try {
      const data=checked(await (await this.request(`${RAW}?t=${Date.now()}`)).json());
      // A CDN response must never replace a newer, already verified record.
      if(this.data&&Date.parse(data.updatedAt)<Date.parse(this.data.updatedAt))return this.apiRead();
      return {data,sha:null};
    } catch(error) {if(error.kind==='schema')throw error;return this.apiRead();}
  }
  accept(result,status='Synced with GitHub') {
    if(this.data&&Date.parse(result.data.updatedAt)<Date.parse(this.data.updatedAt))throw Error('GitHub returned an older record. Your newer saved copy has been kept.');
    this.data=result.data;this.sha=result.sha;this.status=status;this.error='';this.checkedAt=new Date().toISOString();
    try{this.storage?.setItem(CACHE,JSON.stringify({data:this.data,at:this.checkedAt}));}catch{/* Storage is optional, never a successful write. */}
  }
  async load() {
    if(this.busy||this.reading)return this.data;
    this.reading=true;this.status='Refreshing';this.notify();
    try {this.accept(await this.remoteRead());}
    catch(error) {
      if(!this.data)try{const cache=JSON.parse(this.storage?.getItem(CACHE)||'null');if(cache){this.data=checked(cache.data);this.checkedAt=cache.at;}}catch{/* Ignore invalid cache. */}
      if(!this.data)try{this.data=checked(await (await this.request('./data/health.json')).json());this.checkedAt=null;}catch{/* No usable copy. */}
      this.status=this.data?'Saved copy · not live':'Connection unavailable';
      this.error=`${error.message} ${this.data?'Showing older saved data, not a confirmed live total.':'No verified data could be loaded.'}`;
    } finally {this.reading=false;this.notify();}
    return this.data;
  }
  async connect(token) {
    if(this.busy||this.reading)throw Error('Wait for the current sync to finish, then connect.');
    if(!token?.trim())throw Error('Enter a GitHub token in this form.');
    this.#token=token.trim();
    try {
      const user=await (await this.request('https://api.github.com/user',{headers:this.headers()})).json();
      const result=await this.apiRead();this.accept(result);this.account=user.login||'GitHub user';this.notify();
    } catch(error) {this.#token='';this.account=null;throw error;}
  }
  disconnect(){if(this.busy)throw Error('Wait for the current save to finish.');this.#token='';this.account=null;this.notify();}
  async save(mutate,message) {
    if(!this.connected)throw Error('Connect GitHub in this form to save. No data has been written.');
    if(this.busy||this.reading)throw Error('A sync is already in progress. Please retry in a moment.');
    this.busy=true;this.status='Saving';this.notify();
    let submitted=false;
    try {
      for(let attempt=0;attempt<2;attempt++) {
        const fresh=await this.apiRead();const data=structuredClone(fresh.data);
        mutate(data);data.updatedAt=new Date().toISOString();checked(data);
        let result;
        try {
          submitted=true;
          result=await (await this.request(API,{method:'PUT',headers:{...this.headers(),'Content-Type':'application/json'},
            body:JSON.stringify({message,content:encode(JSON.stringify(data,null,2)+'\n'),sha:fresh.sha,branch:'main'})})).json();
        } catch(error) {
          if(error.status===409&&attempt===0){submitted=false;continue;}
          if(error.status)submitted=false;
          if(error.status===409||error.status===422)throw Error('GitHub rejected the update. The record may have changed; refresh before retrying. Nothing was overwritten.');
          throw error;
        }
        if(!result.commit?.sha)throw Error('GitHub did not return a commit to verify.');
        // Verify the immutable committed file, not a CDN response or optimistic local clone.
        const verified=await this.apiRead(result.commit.sha);
        if(JSON.stringify(verified.data)!==JSON.stringify(data))throw Error('Read-back did not match the submitted record.');
        this.lastCommit=result.commit.sha;this.accept(verified,'Save verified on GitHub');
        return verified.data;
      }
    } catch(error) {
      this.status=submitted?'Save needs verification':'Not saved';
      this.error=submitted?'The save could not be confirmed. Refresh before retrying to avoid duplicate records.':error.message;
      throw Error(this.error);
    } finally {this.busy=false;this.notify();}
  }
}
