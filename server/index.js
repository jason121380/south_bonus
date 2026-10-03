import {createDatabase,migrate} from './db.js';
import {bootstrapAdmin} from './auth.js';
import {createApp} from './app.js';
const embedded=process.env.LOCAL_DB==='1';
const db=await createDatabase({embedded,path:embedded?'.local-db':undefined});
await migrate(db);await bootstrapAdmin(db);
const server=createApp(db).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`South Bonus listening on port ${Number(process.env.PORT)||3000}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(async()=>{await db.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref();});
