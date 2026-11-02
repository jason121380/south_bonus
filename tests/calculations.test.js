import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '../server/calculations.js';
const input = {month:'2026-10',designer:'測試',monthlyAdFee:10000,onlineRevenue:47250,adItem:'染髮',socialPost:'yes',replyWithin:'yes',followSop:'yes'};
test('ROI threshold 350% uses actual fee including 5%, caps at 50% and clears criteria',()=>{
 const x=normalizeRecord('subsidy',input); assert.equal(x.actualAdFee,10500);assert.equal(x.roi,3.5);assert.equal(x.roiHit,true);assert.equal(x.subsidyPercent,50);assert.equal(x.departmentSubsidy,5250);assert.equal(x.socialPost,'');assert.equal(x.allThreeBonus,false);
 assert.equal(normalizeRecord('subsidy',{...input,onlineRevenue:47249}).subsidyPercent,40);
 assert.equal(normalizeRecord('subsidy',{...input,onlineRevenue:47249}).roiHit,false);
 assert.equal(normalizeRecord('subsidy',{...input,onlineRevenue:36750}).subsidyPercent,40);
});
test('ROI formula example, zero and negative values',()=>{
 const x=normalizeRecord('subsidy',{...input,onlineRevenue:50000});assert.equal(Math.round(x.roi*100),376);assert.equal(x.roiHit,true);assert.equal(x.subsidyPercent,50);
 for(const v of [{onlineRevenue:0},{monthlyAdFee:0}]){const z=normalizeRecord('subsidy',{...input,...v});assert.equal(z.roi,null);assert.equal(z.roiHit,false);}
 const n=normalizeRecord('subsidy',{...input,onlineRevenue:5250});assert.equal(n.roi,-0.5);assert.equal(n.roiHit,false);
 for(const k of [1,3,7,249,1234]){const fee=40*k,rev=189*k;assert.equal(normalizeRecord('subsidy',{...input,monthlyAdFee:fee,onlineRevenue:rev}).roiHit,true);assert.equal(normalizeRecord('subsidy',{...input,monthlyAdFee:fee,onlineRevenue:rev-1}).roiHit,false);}
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
