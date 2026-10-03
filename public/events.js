let busy=false;
const arrays={revenue:'revenues',ad:'ads',subsidy:'subsidyReports','traffic-subsidy':'trafficSubsidyReports'};
const fields=form=>Object.fromEntries(new FormData(form));
function showLogin(message=''){
  currentUser=null;users=[];
  for(const key of Object.values(arrays))state[key]=[];
  state.settings={margin:50,goals:{},designers:DESIGNERS,version:1};
  $('#appShell').hidden=true;$('#loginScreen').hidden=false;$('#loginError').textContent=message;
  $('#loginForm [name=password]').value='';
  for(const form of ['subsidyForm','trafficSubsidyForm','userForm','userEditForm','passwordForm'])$('#'+form).reset();
  subsidyEditId=trafficEditId=null;subsidyOriginal=trafficOriginal=null;editCtx=null;
  for(const d of $$('dialog'))if(d.open)d.close();
  $('#ownerFilter').innerHTML='';render();$('#usersTable').innerHTML='';
}
window.addEventListener('session-expired',()=>showLogin('登入已失效，請重新登入'));
async function action(fn){
  if(busy){toast('正在處理，請稍候');return;}
  busy=true;const buttons=$$('button[type=submit],.danger,#ownerFilter,#monthFilter');const prior=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);
  try{await fn();}catch(error){toast(error.message);if(error.status===409&&currentUser)try{await refresh();}catch{} }
  finally{busy=false;buttons.forEach((b,i)=>b.disabled=prior[i]);}
}
function fillUsers(){
  const filter=$('#ownerFilter'),selected=filter.value||currentUser.id;
  filter.innerHTML='<option value="all">全部用戶</option>'+users.map(u=>`<option value="${u.id}">${escapeHtml(u.displayName)}${u.active?'':'（停用）'}</option>`).join('');
  filter.value=[...filter.options].some(o=>o.value===selected)?selected:currentUser.id;
  $('#usersTable').innerHTML=users.map(u=>`<tr><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.displayName)}</td><td>${u.role==='admin'?'管理員':'一般用戶'}</td><td>${u.active?'啟用':'停用'}</td><td><button type="button" class="edit-user-btn secondary" data-id="${u.id}">編輯／重設密碼</button></td></tr>`).join('');
}
async function reloadUsers(){if(currentUser.role==='admin'){users=await API.request('/users');fillUsers();}}
async function refresh(){
  const selected=currentUser.role==='admin'?$('#ownerFilter').value:currentUser.id;
  const suffix=selected&&selected!=='all'?`?ownerId=${encodeURIComponent(selected)}`:'';
  const data=await API.request('/state'+suffix);
  Object.assign(state,data);fillDesignerSelect();render();
  // Include ownership in admin tables without exposing any extra data to normal users.
  if(currentUser.role==='admin'){
    for(const id of ['subsidyTable','trafficSubsidyTable','revenueTable','adTable']){
      for(const row of $('#'+id).querySelectorAll('tr')){
        const button=row.querySelector('[data-id]');if(!button)continue;
        const item=Object.values(arrays).flatMap(key=>state[key]).find(r=>r.id===button.dataset.id);
        if(item){const badge=document.createElement('small');badge.className='owner-badge';badge.textContent=`擁有者：${item.ownerName||users.find(u=>u.id===item.ownerId)?.displayName||''}`;row.children[1].appendChild(badge);}
      }
    }
  }
}
async function enter(user){
  currentUser=user;$('#accountName').textContent=user.displayName;$('#accountRole').textContent=user.role==='admin'?'管理員':'一般用戶';
  $$('.admin-only').forEach(el=>el.hidden=user.role!=='admin');
  await reloadUsers();await refresh();setupDefaults();switchView('subsidy');$('#loginScreen').hidden=true;$('#appShell').hidden=false;
}
async function persist(kind,data,original){
  const body={data};
  if(original){body.version=original.version;await API.request(`/records/${original.id}`,{method:'PUT',body});}
  else{body.kind=kind;await API.request('/records',{method:'POST',body});}
  await refresh();
}
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();action(async()=>{
  $('#loginError').textContent='';
  try{const user=await API.request('/login',{method:'POST',body:fields(e.currentTarget)});await enter(user);e.target.reset();}
  catch(error){$('#loginError').textContent=error.message;throw error;}
});});
$('#logoutButton').addEventListener('click',()=>action(async()=>{await API.request('/logout',{method:'POST',body:{}});showLogin();}));
$$('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('#monthFilter').addEventListener('change',()=>{render();fillSettings();if(!subsidyEditId)$('#subsidyForm [name=month]').value=selectedMonth();if(!trafficEditId)$('#trafficSubsidyForm [name=month]').value=selectedMonth();});
$('#ownerFilter').addEventListener('change',()=>action(async()=>{await refresh();resetSubsidyForm();resetTrafficSubsidyForm();}));
$('#subsidyForm').addEventListener('click',e=>{const b=e.target.closest('.choice-btn');if(!b||b.disabled)return;setChoice(b.closest('[data-choice]').dataset.choice,b.dataset.value);});
for(const name of ['monthlyAdFee','onlineRevenue'])$('#subsidyForm [name='+name+']').addEventListener('input',updateSubsidyCalc);
$('#subsidyForm [name=replyMinutes]').addEventListener('input',updateReplyTimeDisplay);
$('#replyTimeQuick').addEventListener('click',e=>{const b=e.target.closest('[data-minutes]');if(b){$('#subsidyForm [name=replyMinutes]').value=b.dataset.minutes;updateReplyTimeDisplay();}});
$('#replyMinuteTail').addEventListener('click',e=>{const b=e.target.closest('[data-digit]');if(b){const input=$('#subsidyForm [name=replyMinutes]');input.value=Math.floor(Math.max(0,Number(input.value)||0)/10)*10+Number(b.dataset.digit);updateReplyTimeDisplay();}});
$('#subsidyForm').addEventListener('submit',e=>{e.preventDefault();const data=fields(e.currentTarget);data.replyMinutes=Number(data.replyMinutes)||0;action(async()=>{
  const wasEdit=!!subsidyEditId;await persist('subsidy',data,subsidyOriginal);resetSubsidyForm();subsidyOriginal=null;switchView('subsidy-records');toast(wasEdit?'補助回報已更新':'補助回報已儲存');
});});
$('#resetSubsidyForm').addEventListener('click',()=>{resetSubsidyForm();subsidyOriginal=null;});
for(const name of ['monthlyAdFee','actualRevenue'])$('#trafficSubsidyForm [name='+name+']').addEventListener('input',updateTrafficSubsidyCalc);
$('#trafficSubsidyForm').addEventListener('submit',e=>{e.preventDefault();const data=fields(e.currentTarget);action(async()=>{const wasEdit=!!trafficEditId;await persist('traffic-subsidy',data,trafficOriginal);resetTrafficSubsidyForm();trafficOriginal=null;toast(wasEdit?'流量型補助已更新':'流量型補助已儲存');});});
$('#resetTrafficSubsidyForm').addEventListener('click',()=>{resetTrafficSubsidyForm();trafficOriginal=null;});
document.addEventListener('click',e=>{
  const subsidy=e.target.closest('.edit-subsidy-btn');
  if(subsidy){const r=state.subsidyReports.find(x=>x.id===subsidy.dataset.id);if(!r)return;resetSubsidyForm();subsidyEditId=r.id;subsidyOriginal={...r};switchView('subsidy');const f=$('#subsidyForm');
    for(const name of ['month','designer','monthlyAdFee','onlineRevenue','replyMinutes'])f.elements[name].value=r[name]??'';

    // Set every choice before recalculation to avoid using a previous record's ROAS.
    for(const name of ['adItem','socialPost','replyWithin','followSop','talentType']){f.elements[name].value=r[name]||'';f.querySelectorAll(`[data-choice="${name}"] .choice-btn`).forEach(b=>b.classList.toggle('selected',b.dataset.value===f.elements[name].value));}
    updateSubsidyCalc();updateReplyTimeDisplay();toast('已載入紀錄，修改後儲存');return;
  }
  const traffic=e.target.closest('.edit-traffic-btn');
  if(traffic){const r=state.trafficSubsidyReports.find(x=>x.id===traffic.dataset.id);if(!r)return;trafficEditId=r.id;trafficOriginal={...r};switchView('traffic-subsidy');const f=$('#trafficSubsidyForm');for(const name of ['month','designer','monthlyAdFee','actualRevenue'])f.elements[name].value=r[name];updateTrafficSubsidyCalc();return;}
  const edit=e.target.closest('.edit-btn');if(edit){openEdit(edit.dataset.type,edit.dataset.id);return;}
  const del=e.target.closest('.delete-btn');
  if(del){const r=state[arrays[del.dataset.type]].find(x=>x.id===del.dataset.id);if(!r||!confirm('確定刪除這筆紀錄？'))return;action(async()=>{await API.request(`/records/${r.id}`,{method:'DELETE',body:{version:r.version}});await refresh();toast('紀錄已刪除');});return;}
  const editUser=e.target.closest('.edit-user-btn');if(editUser){const user=users.find(u=>u.id===editUser.dataset.id);editingUserId=user.id;const f=$('#userEditForm');f.elements.displayName.value=user.displayName;f.elements.role.value=user.role;f.elements.active.checked=user.active;f.elements.password.value='';$('#userDialog').showModal();}
});
$('#editForm').addEventListener('submit',e=>{e.preventDefault();if(!editCtx)return;const data=fields(e.currentTarget),original={...editCtx};action(async()=>{await persist(original.type,data,original);$('#editDialog').close();editCtx=null;toast('紀錄已更新');});});
for(const id of ['closeEdit','cancelEdit'])$('#'+id).addEventListener('click',()=>{editCtx=null;$('#editDialog').close();});
$('#settingsForm').addEventListener('submit',e=>{e.preventDefault();const data=fields(e.currentTarget);action(async()=>{
  const settings=API.settingsPayload(data,state.settings,selectedMonth());
  await API.request('/settings',{method:'PUT',body:settings});await refresh();toast('設定已儲存');
});});
$('#clearData').addEventListener('click',()=>{if(confirm('確定清除你自己全部的業績、廣告費及兩種補助紀錄？設定會保留，其他用戶資料不受影響。'))action(async()=>{await API.request('/records',{method:'DELETE',body:{confirmation:'CLEAR_MY_RECORDS'}});await refresh();toast('你的紀錄已清除');});});
$('#userForm').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget,data=fields(form);action(async()=>{await API.request('/users',{method:'POST',body:data});form.reset();await reloadUsers();toast('用戶已建立');});});
$('#closeUserEdit').addEventListener('click',()=>$('#userDialog').close());
$('#userEditForm').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget,data=fields(form);data.active=form.elements.active.checked;if(!data.password)delete data.password;action(async()=>{await API.request(`/users/${editingUserId}`,{method:'PATCH',body:data});$('#userDialog').close();await reloadUsers();toast('用戶已更新');});});
$('#passwordForm').addEventListener('submit',e=>{e.preventDefault();const data=fields(e.currentTarget);action(async()=>{await API.request('/password',{method:'POST',body:data});showLogin('密碼已更新，請使用新密碼登入');});});
function jsonDownload(filename,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#exportBackup').addEventListener('click',()=>jsonDownload(`south-bonus-${today}.json`,state));
$('#importBackup').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>5*1024*1024){toast('檔案超過 5 MB');return;}action(async()=>{
  let payload;try{payload=JSON.parse(await file.text());}catch{throw new Error('檔案不是有效 JSON');}
  if(!confirm('匯入紀錄會歸目前登入帳號所有。遇到重複紀錄會取消整次匯入，確定繼續？'))return;
  const result=await API.request('/import',{method:'POST',body:payload});await refresh();toast(`已匯入 ${result.count} 筆紀錄`);
});});
$$('.report-tab').forEach(b=>b.addEventListener('click',()=>{$$('.report-tab').forEach(x=>x.classList.toggle('active',x===b));$$('.report-panel').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.report+'ReportPanel').classList.add('active');}));
$('#exportSubsidy').addEventListener('click',()=>csvDownload(`廣告補助回報-${selectedMonth()}.csv`,['月份','姓名','廣告項目','每月廣告費用','實際廣告費用＋5%','網路業績','投報率','3.5倍達標','貼文及限時動態','1.5小時內回覆','回覆時間','遵循SOP','三項達標加10%','本次補助％數','事業部補助費用','設計師負擔金額','新秀／首次投放'],currentSubsidyReports().map(r=>[r.month,r.designer,r.adItem,r.monthlyAdFee,r.actualAdFee,r.onlineRevenue,Number(r.roas||0).toFixed(2),r.roasHit?'達標':'未達標',r.roasHit?'不適用':(r.socialPost==='yes'?'達標':'未達標'),r.roasHit?'不適用':(r.replyWithin==='yes'?'達標':'未達標'),r.replyTime||'',r.roasHit?'不適用':(r.followSop==='yes'?'達標':'未達標'),r.roasHit?'不適用':(r.allThreeBonus?'10%':'0%'),`${r.subsidyPercent}%`,r.departmentSubsidy,r.designerBurden,r.talentType||'一般'])));
$('#exportDaily').addEventListener('click',()=>csvDownload(`每日報表-${selectedMonth()}.csv`,['日期','業績','人數','平均客單','廣告客業績','新客','回客/其他'],dailyReport().map(r=>[r.date,r.revenue,r.count,r.revenue/r.count,r.adRevenue,r.newCount,r.count-r.newCount])));
$('#exportMonthly').addEventListener('click',()=>csvDownload('每月報表.csv',['月份','總業績','人數','平均客單','廣告費','廣告業績','ROAS','目標達成率'],monthlyReport().map(r=>[r.month,r.revenue,r.count,r.avg,r.spend,r.adRevenue,r.roas??'',r.goalRate??''])));
// Remove the old service worker: private API data must never be cached offline.
if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(list=>Promise.all(list.map(r=>r.unregister()))).catch(()=>{});
setupDefaults();render();
(async()=>{try{await enter(await API.request('/me'));}catch(error){if(error.status!==401)showLogin(error.message);}})();
