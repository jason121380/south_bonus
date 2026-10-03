import pg from 'pg';
import {readFile} from 'node:fs/promises';
export async function createDatabase({url = process.env.DATABASE_URL,embedded = false,path} = {}) {
  if(embedded) {
    if(process.env.NODE_ENV === 'production') throw new Error('正式環境必須使用 PostgreSQL DATABASE_URL');
    const {PGlite} = await import('@electric-sql/pglite');
    const db = new PGlite(path);await db.waitReady;
    return {query:(sql,args)=>db.query(sql,args),exec:sql=>db.exec(sql),transaction:fn=>db.transaction(tx=>fn({query:(sql,args)=>tx.query(sql,args),exec:sql=>tx.exec(sql)})),close:()=>db.close()};
  }
  if(!url) throw new Error('請設定 DATABASE_URL，或在本機設定 LOCAL_DB=1');
  const pool=new pg.Pool({connectionString:url,max:10,connectionTimeoutMillis:10000});
  pool.on('error',()=>console.error('資料庫連線中斷'));
  return {query:(sql,args)=>pool.query(sql,args),exec:sql=>pool.query(sql),close:()=>pool.end(),transaction:async fn=>{
    const client=await pool.connect();
    try{await client.query('BEGIN');const result=await fn({query:(sql,args)=>client.query(sql,args),exec:sql=>client.query(sql)});await client.query('COMMIT');return result;}
    catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }};
}
export async function migrate(db) {
  await db.transaction(async tx=>{
    // Serialize first boot migrations across replicas without PostgreSQL extensions.
    await tx.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    await tx.exec('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
    if(!(await tx.query('SELECT version FROM schema_migrations WHERE version=1')).rows.length){
      await tx.exec(await readFile(new URL('./migrations/001.sql',import.meta.url),'utf8'));
      await tx.query('INSERT INTO schema_migrations(version) VALUES(1)');
    }
  });
}
