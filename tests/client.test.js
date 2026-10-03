import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('API reports rejected saves and network failure; emits session-expired notification',async()=>{
 const source=await readFile(new URL('../public/api.js',import.meta.url),'utf8');
 const events=[];const context={window:{dispatchEvent:e=>events.push(e.type)},CustomEvent:class{constructor(type){this.type=type}},fetch:async()=>({ok:false,status:409,json:async()=>({error:'紀錄已存在'})})};
 vm.createContext(context);vm.runInContext(source,context);
 await assert.rejects(context.window.API.request('/records',{method:'POST',body:{}}),/紀錄已存在/);
 context.fetch=async()=>{throw new Error('network')};await assert.rejects(context.window.API.request('/records',{method:'POST',body:{}}),/連線/);
 context.fetch=async()=>({ok:false,status:401,json:async()=>({error:'請重新登入'})});await assert.rejects(context.window.API.request('/state'),/請重新登入/);assert.deepEqual(events,['session-expired']);
});
test('expired session clears private data and resets only forms present in product UI',async()=>{
 const source=await readFile(new URL('../public/events.js',import.meta.url),'utf8'),html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const elements=new Map();
 for(const match of html.matchAll(/id="([^"]+)"/g))elements.set('#'+match[1],{hidden:false,textContent:'',innerHTML:'',reset(){}});
 elements.set('#loginForm [name=password]',{value:'secret'});
 const context={currentUser:{id:'A'},users:[{id:'A'}],state:{revenues:[{}],ads:[{}],subsidyReports:[{}],trafficSubsidyReports:[{}]},arrays:{revenue:'revenues',ad:'ads',subsidy:'subsidyReports','traffic-subsidy':'trafficSubsidyReports'},DESIGNERS:['A'],subsidyEditId:'x',trafficEditId:'y',subsidyOriginal:{},trafficOriginal:{},editCtx:{},$:selector=>elements.get(selector)||null,$$:()=>[],render(){}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function showLogin('),source.indexOf("window.addEventListener('session-expired'")),context);context.showLogin('登入失效');
 assert.equal(context.state.subsidyReports.length,0);assert.equal(elements.get('#appShell').hidden,true);assert.equal(elements.get('#loginForm [name=password]').value,'');
});
test('settings save preserves loaded ownership rather than current selector or forged form owner',async()=>{
 const source=await readFile(new URL('../public/api.js',import.meta.url),'utf8');const context={window:{}};vm.createContext(context);vm.runInContext(source,context);
 const result=context.window.API.settingsPayload({margin:'60',goal:'100000',ownerId:'B'},{margin:50,goals:{},designers:['A'],version:3,ownerId:'A'},'2026-10');
 assert.equal(result.ownerId,'A');assert.equal(result.version,3);assert.equal(result.goals['2026-10'],100000);
});
test('clearing either subsidy form also abandons its edit snapshot',async()=>{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const form={reset(){},elements:{month:{value:''}}};
 const context={subsidyEditId:'old',trafficEditId:'old',subsidyOriginal:{id:'old'},trafficOriginal:{id:'old'},$:()=>form,selectedMonth:()=> '2026-10',resetChoiceGroups(){},updateSubsidyCalc(){},updateReplyTimeDisplay(){},fillDesignerSelect(){},updateTrafficSubsidyCalc(){}};
 vm.createContext(context);
 const subsidy=source.match(/function resetSubsidyForm\(\)\{[^\n]+/)[0];const traffic=source.match(/function resetTrafficSubsidyForm\(\)\{[^\n]+/)[0];
 vm.runInContext(subsidy+'\n'+traffic,context);context.resetSubsidyForm();context.resetTrafficSubsidyForm();
 assert.equal(context.subsidyOriginal,null);assert.equal(context.trafficOriginal,null);
});
test('imported designers remain selectable when editing legacy records',async()=>{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');const selects=[{value:'舊設計師',innerHTML:''},{value:'',innerHTML:''}];
 const context={state:{settings:{designers:['預設']},subsidyReports:[{designer:'舊設計師'}],trafficSubsidyReports:[]},$:id=>id==='#subsidyDesigner'?selects[0]:selects[1],escapeHtml:String};
 vm.createContext(context);vm.runInContext(source.match(/function fillDesignerSelect\(\)\{[^\n]+/)[0],context);context.fillDesignerSelect();assert.match(selects[0].innerHTML,/舊設計師/);assert.equal(selects[0].value,'舊設計師');
});
