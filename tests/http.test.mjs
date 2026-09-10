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
   const base='http://127.0.0.1:3137';let cookie='';
   const request=(path,body,headers={})=>fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie,...headers},...(body?{body:JSON.stringify(body)}:{})});
   assert.equal((await request('/')).status,200);
   assert.equal((await request('/api/state')).status,401);
   const login=await request('/api/demo-login',{userId:'demo-me'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);
   assert.equal((await request('/api/listings/sample-3/status',{status:'returned'},{Origin:'https://evil.example'})).status,403);
   const uploaded=await request('/api/uploads',{data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOXcAAAAASUVORK5CYII='});assert.equal(uploaded.status,200);const {url}=await uploaded.json();assert.equal((await request(url)).status,200);
   const created=await request('/api/listings',{type:'found',title:'Test water bottle',description:'Found this bottle beside the main library.',category:'Other',location:'Main Library',date:new Date().toISOString().slice(0,10),images:[url]});assert.equal(created.status,200);const listing=await created.json();
   const persisted=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));assert.ok(persisted.listings.some(x=>x.id===listing.id));
   assert.equal((await request('/api/uploads',{data:'data:text/html;base64,PGgxPkhlbGxvPC9oMT4='})).status,400);
   await request('/api/logout',{});assert.equal((await request('/api/state')).status,401);
 }finally{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});await rm(dir,{recursive:true,force:true});}
});
