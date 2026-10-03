import {randomUUID} from 'node:crypto';
import {AppError,normalizeRecord,normalizeSettings} from './calculations.js';
export const DESIGNERS=['PS62 QQ','PS8 Teddy','PS8 KJ','PS5 Mark','PS5 jolie','PS2 lori','PS2 kyra','PS2 小橘','PS2 polly','公主 ben','公主 萊恩','PS2 Allan','PS5 小P','PS8 Jenny','PS36 小樂','PS81 采連'];
export const defaultSettings=()=>({margin:50,goals:{},designers:DESIGNERS});
export const validId=id=>{if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new AppError(400,'識別碼格式不正確');return id;};
export const version=value=>{if(!Number.isInteger(value)||value<1)throw new AppError(400,'請提供資料版本');return value;};
export const record=row=>({...row.data,id:row.id,ownerId:row.owner_id,ownerName:row.owner_name,kind:row.kind,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at});
export function ownerFor(user,requested){
  if(requested&&requested!==user.id&&user.role!=='admin')throw new AppError(403,'只能操作自己的資料');
  return validId(requested||user.id);
}
export async function insertRecord(tx,user,body){
  ownerFor(user,body.ownerId);
  const ownerId=user.id,data=normalizeRecord(body.kind,body.data);
  if(!(await tx.query('SELECT id FROM users WHERE id=$1 AND active=true',[ownerId])).rows.length)throw new AppError(400,'資料擁有者不存在或已停用');
  const {rows}=await tx.query('INSERT INTO records(id,owner_id,kind,designer,month,data) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),ownerId,body.kind,data.designer||null,data.month||null,JSON.stringify(data)]);
  return record(rows[0]);
}
export async function accessibleRecord(tx,user,id){
  const {rows}=await tx.query('SELECT * FROM records WHERE id=$1 AND ($2::boolean OR owner_id=$3) FOR UPDATE',[validId(id),user.role==='admin',user.id]);
  if(!rows.length)throw new AppError(404,'找不到這筆紀錄');return rows[0];
}
export async function settingsFor(db,ownerId){
  await db.query('INSERT INTO user_settings(owner_id,data) VALUES($1,$2) ON CONFLICT DO NOTHING',[ownerId,JSON.stringify(defaultSettings())]);
  const row=(await db.query('SELECT * FROM user_settings WHERE owner_id=$1',[ownerId])).rows[0];
  return {...row.data,version:row.version,ownerId:row.owner_id};
}
export async function saveSettings(db,user,body){
  const ownerId=ownerFor(user,body.ownerId);await settingsFor(db,ownerId);
  const data=normalizeSettings(body),v=version(body.version);
  const {rows}=await db.query('UPDATE user_settings SET data=$1,version=version+1 WHERE owner_id=$2 AND version=$3 RETURNING *',[JSON.stringify(data),ownerId,v]);
  if(!rows.length)throw new AppError(409,'設定已被更新，請重新載入');return {...rows[0].data,version:rows[0].version,ownerId};
}
export async function importData(db,user,body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new AppError(400,'匯入格式不正確');
  ownerFor(user,body.ownerId); // Imports always belong to the logged-in account.
  if(body.ownerId&&body.ownerId!==user.id)throw new AppError(400,'匯入資料只能歸登入者所有');
  const entries=[];
  for(const [key,kind] of Object.entries({revenues:'revenue',ads:'ad',subsidyReports:'subsidy',trafficSubsidyReports:'traffic-subsidy'})){
    if(body[key]!==undefined&&!Array.isArray(body[key]))throw new AppError(400,`${key}需為陣列`);
    for(const item of body[key]||[]){entries.push({kind,data:normalizeRecord(kind,item)});if(entries.length>10000)throw new AppError(400,'每次最多匯入 10000 筆');}
  }
  if(!entries.length)throw new AppError(400,'沒有可匯入的紀錄');
  return db.transaction(async tx=>{
    // A fingerprint prevents repeat imports even for non-subsidy records.
    await tx.exec('LOCK TABLE records IN SHARE ROW EXCLUSIVE MODE');
    for(const item of entries){
      if((await tx.query('SELECT id FROM records WHERE owner_id=$1 AND kind=$2 AND data=$3::jsonb LIMIT 1',[user.id,item.kind,JSON.stringify(item.data)])).rows.length)throw new AppError(409,'匯入包含已存在的紀錄，原有資料已保留');
      await insertRecord(tx,user,item);
    }
    return {count:entries.length};
  });
}
