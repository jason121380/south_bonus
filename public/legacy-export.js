document.querySelector('#legacyExport').addEventListener('click',()=>{
  const output=document.querySelector('#legacyResult');
  try {
    const data=JSON.parse(localStorage.getItem('salon-performance-v4')||localStorage.getItem('salon-performance-v3')||'null');
    if(!data){output.textContent='此網址沒有找到舊資料，請確認使用舊版原本的網址與瀏覽器。';return;}
    const payload={};for(const key of ['revenues','ads','subsidyReports','trafficSubsidyReports'])payload[key]=Array.isArray(data[key])?data[key]:[];
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='south-bonus-legacy.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);output.textContent='匯出完成，原本資料已保留。';
  }catch{output.textContent='舊資料無法解析，請保留原資料並聯絡管理員。';}
});
