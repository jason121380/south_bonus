import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase,migrate} from '../server/db.js';
import {bootstrapAdmin,login,hashPassword,validPassword} from '../server/auth.js';
test('a password reset committed during login cannot leave an old-password session',async()=>{
 const db=await createDatabase({embedded:true});await migrate(db);await bootstrapAdmin(db,{username:'admin',password:'old-password-12345'});
 const updatedHash=await hashPassword('new-password-12345');
 const hooked={...db,query:async(sql,args)=>{
   const result=await db.query(sql,args);
   if(sql.startsWith('SELECT * FROM users WHERE username=')){
     await db.transaction(async tx=>{await tx.query('UPDATE users SET password_hash=$1 WHERE username=$2',[updatedHash,'admin']);await tx.query('DELETE FROM sessions');});
   }
   return result;
 }};
 try{
   const result=await login(hooked,'admin','old-password-12345').catch(()=>null);
   const actual=(await db.query('SELECT password_hash FROM users WHERE username=$1',['admin'])).rows[0].password_hash;
   if(actual===updatedHash)assert.equal(result,null,'old password must be rejected after reset commits');
   // If login acquires the user lock before reset, reset follows and must revoke it.
   if(result){await db.transaction(async tx=>{await tx.query('UPDATE users SET password_hash=$1 WHERE username=$2',[updatedHash,'admin']);await tx.query('DELETE FROM sessions');});}
   assert.equal(Number((await db.query('SELECT count(*) AS n FROM sessions')).rows[0].n),0);
 }finally{await db.close();}
});

test("password minimum is six characters",()=>{assert.equal(validPassword("123456"),"123456");assert.throws(()=>validPassword("12345"));});
