import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChatGPTLink,readChatGPTLink,saveChatGPTLink} from '../dist/chatgpt-link.js';
test('saved ChatGPT links stay on ChatGPT, strip queries and never accept credentials or script URLs',()=>{
  assert.equal(normalizeChatGPTLink(''),'https://chatgpt.com/');assert.equal(normalizeChatGPTLink('https://chatgpt.com/c/example-chat?secret=removed#part'),'https://chatgpt.com/c/example-chat');assert.equal(normalizeChatGPTLink('https://chatgpt.com/g/g-p-example/project'),'https://chatgpt.com/g/g-p-example/project');
  for(const url of ['javascript:alert(1)','http://chatgpt.com/c/a','https://chatgpt.com.evil.test/c/a','https://person:secret@chatgpt.com/c/a','https://chatgpt.com/api/auth/session'])assert.throws(()=>normalizeChatGPTLink(url));
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};saveChatGPTLink('https://chatgpt.com/c/example-chat',storage);assert.equal(readChatGPTLink(storage),'https://chatgpt.com/c/example-chat');map.set('cams-life-chatgpt-link','https://evil.test/');assert.equal(readChatGPTLink(storage),'https://chatgpt.com/');
});
