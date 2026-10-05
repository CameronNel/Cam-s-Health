const KEY='cams-life-chatgpt-link';
export function normalizeChatGPTLink(value) {
  if(!String(value||'').trim())return 'https://chatgpt.com/';
  let url;try{url=new URL(String(value).trim());}catch{throw Error('Enter a full https://chatgpt.com conversation or project URL.');}
  if(url.origin!=='https://chatgpt.com'||url.username||url.password||!/^\/(?:$|c\/[\w-]+\/?$|g\/[\w/-]+\/?$)/.test(url.pathname))throw Error('Use only a ChatGPT conversation or project link on https://chatgpt.com.');
  url.search='';url.hash='';return url.href;
}
export function readChatGPTLink(storage=globalThis.localStorage) {
  try{return normalizeChatGPTLink(storage.getItem(KEY));}catch{return 'https://chatgpt.com/';}
}
export function saveChatGPTLink(value,storage=globalThis.localStorage) {
  const url=normalizeChatGPTLink(value);
  try{storage.setItem(KEY,url);}catch{throw Error('This browser could not save the link. You can still open ChatGPT home.');}
  return url;
}
