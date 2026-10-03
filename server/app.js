import express from 'express';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {AppError,text} from './calculations.js';
import {authentication,adminOnly,login,setSessionCookie,clearSessionCookie,hashPassword,publicUser,username,verifyPassword} from './auth.js';
import {record,insertRecord,accessibleRecord,ownerFor,validId,version,settingsFor,saveSettings,importData} from './records.js';
import {normalizeRecord} from './calculations.js';
export function createApp(db,{production=process.env.NODE_ENV==='production'}={}){
  const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
  app.use((req,res,next)=>{
    res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});
    if(req.path.startsWith('/api'))res.set('Cache-Control','no-store');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)){
      const origin=req.get('origin');
      if(req.get('sec-fetch-site')==='cross-site')throw new AppError(403,'請從本站操作');
      if(origin){let parsed;try{parsed=new URL(origin);}catch{throw new AppError(403,'來源無效');}if(parsed.host!==req.get('host'))throw new AppError(403,'請從本站操作');}
      if(!req.is('application/json'))throw new AppError(415,'請使用 JSON 資料格式');
    }
    next();
  });
  app.use(express.json({limit:'5mb'}));
  app.get('/health',async(req,res)=>{try{await db.query('SELECT 1');res.json({ok:true});}catch{res.status(503).json({ok:false});}});
  const attempts=new Map();
  app.post('/api/login',async(req,res)=>{
    const key=req.ip,now=Date.now();
    for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
    const entry=attempts.get(key)||{count:0,until:now+15*60*1000};
    if(entry.count>=20)throw new AppError(429,'登入嘗試過多，請稍後再試');entry.count++;attempts.set(key,entry);
    const result=await login(db,req.body?.username,req.body?.password);attempts.delete(key);
    setSessionCookie(res,result.token,production);res.json(result.user);
  });
  app.use('/api',authentication(db));
  app.get('/api/me',(req,res)=>res.json(req.user));
  app.post('/api/logout',async(req,res)=>{await db.query('DELETE FROM sessions WHERE token_hash=$1',[req.sessionHash]);clearSessionCookie(res,production);res.json({ok:true});});
  app.post('/api/password',async(req,res)=>{
    const row=(await db.query('SELECT password_hash FROM users WHERE id=$1',[req.user.id])).rows[0];
    if(!await verifyPassword(req.body.currentPassword,row.password_hash))throw new AppError(400,'目前密碼不正確');
    const hash=await hashPassword(req.body.password);
    await db.transaction(async tx=>{await tx.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,req.user.id]);await tx.query('DELETE FROM sessions WHERE user_id=$1',[req.user.id]);});
    clearSessionCookie(res,production);res.json({ok:true});
  });
  app.get('/api/users',adminOnly,async(req,res)=>res.json((await db.query('SELECT * FROM users ORDER BY created_at,username')).rows.map(publicUser)));
  app.post('/api/users',adminOnly,async(req,res)=>{
    const name=username(req.body.username),displayName=text(req.body.displayName||name,'顯示名稱',{required:true,max:100});
    if(!['admin','user'].includes(req.body.role))throw new AppError(400,'角色無效');
    const hash=await hashPassword(req.body.password);
    const row=(await db.query('INSERT INTO users(id,username,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING *',[randomUUID(),name,displayName,hash,req.body.role])).rows[0];res.status(201).json(publicUser(row));
  });
  app.patch('/api/users/:id',adminOnly,async(req,res)=>{
    const id=validId(req.params.id),input=req.body;
    if(input.role!==undefined&&!['admin','user'].includes(input.role))throw new AppError(400,'角色無效');
    if(input.active!==undefined&&typeof input.active!=='boolean')throw new AppError(400,'啟用狀態無效');
    const hash=input.password!==undefined?await hashPassword(input.password):null;
    const displayName=input.displayName!==undefined?text(input.displayName,'顯示名稱',{required:true,max:100}):null;
    const updated=await db.transaction(async tx=>{
      await tx.exec('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const row=(await tx.query('SELECT * FROM users WHERE id=$1',[id])).rows[0];if(!row)throw new AppError(404,'找不到用戶');
      const role=input.role??row.role,active=input.active??row.active;
      if(row.role==='admin'&&row.active&&(role!=='admin'||!active)){
        if(Number((await tx.query("SELECT count(*) AS count FROM users WHERE role='admin' AND active=true")).rows[0].count)<=1)throw new AppError(409,'至少保留一位啟用中的管理員');
      }
      const result=(await tx.query('UPDATE users SET display_name=$1,role=$2,active=$3,password_hash=$4 WHERE id=$5 RETURNING *',[displayName??row.display_name,role,active,hash??row.password_hash,id])).rows[0];
      if(hash||!active||role!==row.role)await tx.query('DELETE FROM sessions WHERE user_id=$1',[id]);
      return publicUser(result);
    });res.json(updated);
  });
  app.get('/api/state',async(req,res)=>{
    const requested=req.query.ownerId;
    const all=req.user.role==='admin'&&!requested;
    const ownerId=ownerFor(req.user,requested);
    const rows=(await db.query('SELECT r.*,u.display_name AS owner_name FROM records r JOIN users u ON u.id=r.owner_id WHERE $1::boolean OR r.owner_id=$2 ORDER BY r.created_at',[all,ownerId])).rows;
    const result={revenues:[],ads:[],subsidyReports:[],trafficSubsidyReports:[],settings:await settingsFor(db,ownerId)};
    const arrays={revenue:'revenues',ad:'ads',subsidy:'subsidyReports','traffic-subsidy':'trafficSubsidyReports'};
    rows.forEach(row=>result[arrays[row.kind]].push(record(row)));res.json(result);
  });
  app.post('/api/records',async(req,res)=>res.status(201).json(await insertRecord(db,req.user,req.body)));
  app.put('/api/records/:id',async(req,res)=>{
    const item=await db.transaction(async tx=>{
      const old=await accessibleRecord(tx,req.user,req.params.id);
      if(version(req.body.version)!==old.version)throw new AppError(409,'這筆紀錄已被更新，請重新載入');
      if(req.body.ownerId!==undefined&&req.body.ownerId!==old.owner_id)throw new AppError(400,'編輯時不能變更資料擁有者');
      const data=normalizeRecord(old.kind,req.body.data);
      return record((await tx.query('UPDATE records SET data=$1,designer=$2,month=$3,version=version+1,updated_at=now() WHERE id=$4 RETURNING *',[JSON.stringify(data),data.designer||null,data.month||null,old.id])).rows[0]);
    });res.json(item);
  });
  app.delete('/api/records/:id',async(req,res)=>{
    await db.transaction(async tx=>{const row=await accessibleRecord(tx,req.user,req.params.id);if(version(req.body.version)!==row.version)throw new AppError(409,'這筆紀錄已被更新，請重新載入');await tx.query('DELETE FROM records WHERE id=$1',[row.id]);});res.status(204).end();
  });
  app.delete('/api/records',async(req,res)=>{
    if(req.body.confirmation!=='CLEAR_MY_RECORDS')throw new AppError(400,'請確認清除自己的紀錄');
    await db.query('DELETE FROM records WHERE owner_id=$1',[req.user.id]);res.json({ok:true});
  });
  app.put('/api/settings',async(req,res)=>res.json(await saveSettings(db,req.user,req.body)));
  app.post('/api/import',async(req,res)=>res.json(await importData(db,req.user,req.body)));
  app.use('/api',(req,res)=>res.status(404).json({error:'找不到 API'}));
  app.use(express.static(fileURLToPath(new URL('../public/',import.meta.url)),{etag:true,maxAge:0}));
  app.use((err,req,res,next)=>{
    if(err.code==='23505')return res.status(409).json({error:'帳號或這位設計師的本月紀錄已存在，原有資料已保留'});
    if(err.type==='entity.too.large')return res.status(413).json({error:'資料超過 5 MB 限制'});
    if(err.type==='entity.parse.failed')return res.status(400).json({error:'JSON 格式不正確'});
    const status=err.status||500;
    if(status>=500)console.error('API error:',err.message);
    res.status(status).json({error:status>=500?'伺服器暫時無法處理，請稍後重試':err.message});
  });
  return app;
}
