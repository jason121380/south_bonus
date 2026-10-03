import {randomUUID,randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {AppError,text} from './calculations.js';
const scrypt=promisify(scryptCallback);
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
export function validPassword(password) {
  if(typeof password!=='string'||password.length<10||password.length>128)throw new AppError(400,'密碼需為 10 至 128 個字元');
  return password;
}
export function username(value) {
  const name=text(value,'帳號',{required:true,max:64}).toLowerCase();
  if(!/^[a-z0-9][a-z0-9_.@-]{2,63}$/.test(name))throw new AppError(400,'帳號需為 3 至 64 個英文字母、數字或 _.@-');
  return name;
}
export async function hashPassword(password){validPassword(password);const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64);return `${salt}:${hash.toString('hex')}`;}
export async function verifyPassword(password,stored){
  if(typeof password!=='string'||password.length>128)return false;
  const [salt,hex]=stored.split(':');const expected=Buffer.from(hex,'hex');const actual=await scrypt(password,salt,64);
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export const publicUser=row=>({id:row.id,username:row.username,displayName:row.display_name,role:row.role,active:row.active});
export async function bootstrapAdmin(db,{username:name=process.env.BOOTSTRAP_ADMIN_USERNAME,password=process.env.BOOTSTRAP_ADMIN_PASSWORD}={}){
  if((await db.query('SELECT id FROM users LIMIT 1')).rows.length)return;
  if(!name||!password)throw new Error('首次啟動需設定 BOOTSTRAP_ADMIN_USERNAME 和 BOOTSTRAP_ADMIN_PASSWORD');
  const account=username(name),passwordHash=await hashPassword(password);
  await db.transaction(async tx=>{
    await tx.exec('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    if(!(await tx.query('SELECT id FROM users LIMIT 1')).rows.length)await tx.query('INSERT INTO users(id,username,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),account,'管理員',passwordHash,'admin']);
  });
}
export function authentication(db){return async(req,res,next)=>{
  const match=(req.headers.cookie||'').match(/(?:^|;\s*)south_session=([a-f0-9]{64})(?:;|$)/);
  if(match){const {rows}=await db.query('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[hashToken(match[1])]);if(rows.length)req.user=publicUser(rows[0]);req.sessionHash=hashToken(match[1]);}
  if(!req.user)throw new AppError(401,'請重新登入');next();
};}
export function adminOnly(req,res,next){if(req.user.role!=='admin')throw new AppError(403,'此功能僅限管理員');next();}
export function setSessionCookie(res,token,production){res.cookie('south_session',token,{httpOnly:true,sameSite:'lax',secure:production,path:'/',maxAge:7*24*60*60*1000});}
export function clearSessionCookie(res,production){res.clearCookie('south_session',{httpOnly:true,sameSite:'lax',secure:production,path:'/'});}
export async function login(db,name,password){
  const {rows}=await db.query('SELECT * FROM users WHERE username=$1',[typeof name==='string'?name.trim().toLowerCase():'']);
  // Always derive a hash, including unknown usernames.
  const ok=await verifyPassword(password,rows[0]?.password_hash||`${'0'.repeat(32)}:${'0'.repeat(128)}`);
  if(!ok||!rows[0]?.active)throw new AppError(401,'帳號或密碼錯誤，或帳號已停用');
  const token=randomBytes(32).toString('hex');
  await db.query('DELETE FROM sessions WHERE expires_at<=now()');
  return db.transaction(async tx=>{
    const current=(await tx.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[rows[0].id])).rows[0];
    if(!current?.active||current.password_hash!==rows[0].password_hash)throw new AppError(401,'帳號資料已變更，請重新登入');
    await tx.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[hashToken(token),current.id]);
    return {token,user:publicUser(current)};
  });
}
