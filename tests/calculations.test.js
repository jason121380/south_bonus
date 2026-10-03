import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '../server/calculations.js';
const input = {month:'2026-10',designer:'測試',monthlyAdFee:10000,onlineRevenue:36750,adItem:'染髮',socialPost:'yes',replyWithin:'yes',followSop:'yes'};
test('ROAS threshold uses actual fee including 5%, caps at 50% and clears criteria',()=>{
 const x=normalizeRecord('subsidy',input); assert.equal(x.actualAdFee,10500);assert.equal(x.roas,3.5);assert.equal(x.subsidyPercent,50);assert.equal(x.departmentSubsidy,5250);assert.equal(x.socialPost,'');assert.equal(x.allThreeBonus,false);
 assert.equal(normalizeRecord('subsidy',{...input,onlineRevenue:36749}).subsidyPercent,40);
});
test('cooperation criteria produce 0/10/20/40% and require explicit choices',()=>{
 for(const [choices,pct] of [[['no','no','no'],0],[['yes','no','no'],10],[['yes','yes','no'],20],[['yes','yes','yes'],40]]){
  assert.equal(normalizeRecord('subsidy',{...input,onlineRevenue:0,socialPost:choices[0],replyWithin:choices[1],followSop:choices[2]}).subsidyPercent,pct);
 }
 assert.throws(()=>normalizeRecord('subsidy',{...input,onlineRevenue:0,socialPost:''}));
});
test('traffic boundaries and forged derived values',()=>{
 for(const [actualRevenue,pct] of [[149999,0],[150000,20],[199999,20],[200000,30],[250000,40],[300000,50]]){
  const x=normalizeRecord('traffic-subsidy',{...input,actualRevenue,subsidyPercent:100,departmentSubsidy:999999});assert.equal(x.subsidyPercent,pct);assert.equal(x.departmentSubsidy,10500*pct/100);
 }
});
test('rejects missing, negative, nonfinite numbers and invalid calendar month',()=>{
 for(const monthlyAdFee of [undefined,-1,Infinity,'no',null,''])assert.throws(()=>normalizeRecord('subsidy',{...input,monthlyAdFee}));
 assert.throws(()=>normalizeRecord('subsidy',{...input,month:'2026-13'}));
 assert.throws(()=>normalizeRecord('revenue',{date:'2026-02-30',amount:1}));
});
