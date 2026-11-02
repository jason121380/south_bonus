import {normalizeRecord} from './calculations.js';
const CRITERIA=['socialPost','replyWithin','followSop'];
// 一次性資料遷移（2026-11-02）：投報率改為 (網路業績 − 實際廣告費) ÷ 實際廣告費，達標門檻 350%。
// 只重算廣告補助（kind='subsidy'）。先把原資料複製到備份表，再以 normalizeRecord 重算並寫回。
// 原本達標（配合度未填）、重算後未達標的紀錄，配合度無資料，先記為「未達標」並列在 log，需人工補填。
export async function recalcSubsidyRoi(tx,log=console.log){
  await tx.exec('CREATE TABLE IF NOT EXISTS records_backup_roi_20261102 AS SELECT * FROM records WHERE false');
  await tx.exec("INSERT INTO records_backup_roi_20261102 SELECT * FROM records WHERE kind='subsidy'");
  const {rows}=await tx.query("SELECT id,data FROM records WHERE kind='subsidy' ORDER BY month,designer");
  const changes=[];
  for(const row of rows){
    const old=row.data,input={...old},filled=[];
    for(const name of CRITERIA)if(!['yes','no'].includes(input[name])){input[name]='no';filled.push(name)}
    const next=normalizeRecord('subsidy',input);
    const needsCriteria=!next.roiHit&&filled.length>0;
    log(`[roi-recalc-backup] ${JSON.stringify({id:row.id,data:old})}`);
    await tx.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2',[JSON.stringify(next),row.id]);
    const summary={id:row.id,month:old.month,designer:old.designer,onlineRevenue:old.onlineRevenue,actualAdFee:old.actualAdFee,oldRoas:old.roas,newRoi:next.roi,oldPercent:old.subsidyPercent,newPercent:next.subsidyPercent,oldSubsidy:old.departmentSubsidy,newSubsidy:next.departmentSubsidy,needsCriteria};
    if(summary.oldPercent!==summary.newPercent||summary.oldSubsidy!==summary.newSubsidy||old.roasHit!==next.roiHit)changes.push(summary);
    log(`[roi-recalc-row] ${JSON.stringify(summary)}`);
  }
  log(`[roi-recalc-done] ${JSON.stringify({total:rows.length,changed:changes.length})}`);
  return {total:rows.length,changes};
}
