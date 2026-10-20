import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('HTTP workflow: authentication, upload, listing, persistence, CSRF, logout',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vitfinds-test-'));
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3137',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start')),10000);child.stdout.on('data',d=>{if(d.toString().includes('running at')){clearTimeout(timer);resolve();}});child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited: ${code}`));});});
   const base='http://127.0.0.1:3137';let token='';
   const request=(path,body,headers={})=>fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},...(body?{body:JSON.stringify(body)}:{})});
   assert.equal((await request('/')).status,200);
   assert.equal((await request('/api/state')).status,401);
   assert.equal((await request('/api/auth/signup',{name:'Test Student',email:'test@vitstudent.ac.in',password:'Secure#1234'})).status,201);
   assert.equal((await request('/api/auth/signup',{name:'Other Student',email:'other@gmail.com',password:'Secure#1234'})).status,400);
   assert.equal((await request('/api/auth/login',{email:'test@vitstudent.ac.in',password:'wrong-password'})).status,401);
   const login=await request('/api/auth/login',{email:'test@vitstudent.ac.in',password:'Secure#1234'});assert.equal(login.status,200);token=(await login.json()).token;assert.equal(token.split('.').length,3);
   const originalToken=token;token=token.slice(0,-1)+(token.endsWith('a')?'b':'a');assert.equal((await request('/api/state')).status,401);token=originalToken;
   const receiverLogin=await request('/api/demo-login',{userId:'demo-priya'});const receiverToken=(await receiverLogin.json()).token;
   const events=await fetch(base+'/api/events',{headers:{Authorization:`Bearer ${receiverToken}`}});assert.equal(events.status,200);
   const stream=events.body.getReader();assert.match(new TextDecoder().decode((await stream.read()).value),/event: ready/);
   const sent=await request('/api/listings/sample-1/contact',{message:'I can describe those headphones.'});assert.equal(sent.status,200);
   const live=await Promise.race([stream.read(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Live message was not delivered')),3000))]);assert.match(new TextDecoder().decode(live.value),/event: sync/);
   await stream.cancel();
   assert.equal((await request('/api/listings/sample-3/status',{status:'returned'},{Origin:'https://evil.example'})).status,403);
   const uploaded=await request('/api/uploads',{data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOXcAAAAASUVORK5CYII='});assert.equal(uploaded.status,200);const {url}=await uploaded.json();assert.equal((await request(url)).status,200);
   const created=await request('/api/listings',{type:'found',title:'Test water bottle',description:'Found this bottle beside the main library.',category:'Other',location:'Main Library',date:new Date().toISOString().slice(0,10),images:[url]});assert.equal(created.status,200);const listing=await created.json();
   const persisted=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));assert.ok(persisted.listings.some(x=>x.id===listing.id));const account=persisted.users.find(x=>x.email==='test@vitstudent.ac.in');assert.ok(account.passwordHash&&account.passwordSalt);assert.ok(!Object.hasOwn(account,'password'));
   assert.equal((await request('/api/uploads',{data:'data:text/html;base64,PGgxPkhlbGxvPC9oMT4='})).status,400);
   await request('/api/logout',{});assert.equal((await request('/api/state')).status,401);
 }finally{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});await rm(dir,{recursive:true,force:true});}
});
