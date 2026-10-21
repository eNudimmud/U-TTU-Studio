import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryVault } from '../src/lib/coffre/store.ts';
import { accountScope, discoverLocal, emptyCatalog, mergeRemote, parseCatalog, parseRemoteAsset, readCatalog, registerRender, searchMedia, updateCatalog } from '../src/lib/media/catalog.ts';
import { cacheMedia, classify, syncPage, verifyMedia } from '../src/lib/media/sync.ts';
import { createMediaClient, MediaError, type MediaClient } from '../src/lib/media/cloud.ts';
import { createRenderClient, renderCredentialScope } from '../src/lib/render/client.ts';
import { cancelPendingJob, PENDING_RENDER_KEY, type PendingRender } from '../src/lib/render/recovery.ts';
const uuid = '12345678-1234-4234-8234-123456789abc';
const account = 'a'.repeat(64);
const raw = { id: uuid, name:'E*NKI.png', mime_type:'image/png', size: 3, created_at:'2026-10-20T12:00:00Z', prompt_id:'job-12345678', preview_url:'https://storage.example/signed?secret=temporary' };
const row = parseRemoteAsset(raw);
const scope = { project:'film', account, current: () => true };
const cloud = (extra: Partial<MediaClient> = {}): MediaClient => ({ list: async () => ({ assets:[row],hasMore:false,nextOffset:1 }), detail: async () => row, content: async () => new Blob(['png'],{type:'image/png'}), ...extra });
test('migrates additively, reruns idempotently, and preserves legacy bytes and notes', async () => {
 const store=memoryVault(); const entries=[{path:'Projets/film/Cast/alice.png',blob:new Blob(['legacy']),updatedAt:1},{path:'Projets/film/Cast/alice.md',text:'# Alice',updatedAt:2}];
 for(const e of entries) await store.put(e);
 const first=await discoverLocal(store,'film'); const second=await discoverLocal(store,'film');
 assert.equal(first.assets.length,1); assert.equal(second.assets.length,1); assert.equal(await (await store.get(entries[0].path))!.blob!.text(),'legacy'); assert.equal((await store.get(entries[1].path))!.text,'# Alice');
});
test('imports metadata without media downloads, deduplicates, and preserves local classification', async () => {
 const store=memoryVault(); let downloads=0;
 await syncPage(store,scope,cloud({content:async()=>{downloads++;throw Error();}}));
 const before=await readCatalog(store,'film');
 await updateCatalog(store,'film',c=>classify(c,[before.assets[0].id],{sequence:'F',character:'E*NKI',validated:true}));
 await syncPage(store,scope,cloud()); const after=await readCatalog(store,'film');
 assert.equal(after.assets.length,1);assert.equal(downloads,0); assert.equal(after.assets[0].organization.sequence,'F'); assert.equal(after.assets[0].localPath,null);
 assert.doesNotMatch(JSON.stringify(after),/temporary|preview_url|secret/);
 assert.equal(searchMedia(after.assets,'Retrouve toutes les images E*NKI cette semaine',new Date('2026-10-21')).length,1);
});
test('resumes a saved cursor; absence from a partial page never marks a remote deletion',async()=>{
 const store=memoryVault();await syncPage(store,scope,cloud({list:async()=>({assets:[row],hasMore:true,nextOffset:50})}));
 const reopened=await readCatalog(store,'film');assert.equal(reopened.sync[account].offset,50);
 await syncPage(store,scope,cloud({list:async offset=>{assert.equal(offset,50);return {assets:[],hasMore:false,nextOffset:50};}}),reopened.sync[account].offset);
 assert.equal((await readCatalog(store,'film')).assets[0].remote!.availability,'available');
});
test('cache download resolves stable identity afresh, creates a reusable project file and is idempotent',async()=>{
 const store=memoryVault(); await syncPage(store,scope,cloud());const id=(await readCatalog(store,'film')).assets[0].id;let calls=0;
 const client=cloud({content:async id=>{assert.equal(id,uuid);calls++;return new Blob(['png'],{type:'image/png'});}});
 const render={file:async()=>{throw Error('unexpected legacy call');}};
 const path=await cacheMedia(store,scope,client,render,id);
 assert.equal(path,await cacheMedia(store,scope,client,render,id)); assert.equal(calls,1);assert.equal(await (await store.get(path))!.blob!.text(),'png');
 assert.match((await store.get(path.replace('.png','.md')))!.text!,/E\*NKI/);
 const manifest=parseCatalog(JSON.stringify(await readCatalog(store,'film')),'film');assert.equal(manifest.assets[0].localPath,path);
});
test('distinguishes missing from offline; preserves organization and cached bytes',async()=>{
 const store=memoryVault();await syncPage(store,scope,cloud());const id=(await readCatalog(store,'film')).assets[0].id;
 const path=await cacheMedia(store,scope,cloud(),{file:async()=>new Blob()},id);
 await verifyMedia(store,scope,cloud({detail:async()=>{throw new MediaError('missing');}}),[id]);
 assert.equal((await readCatalog(store,'film')).assets[0].remote!.availability,'missing');assert.ok((await store.get(path))?.blob);
 await assert.rejects(verifyMedia(store,scope,cloud({detail:async()=>{throw new MediaError('network');}}),[id]));assert.equal((await readCatalog(store,'film')).assets[0].remote!.availability,'unknown');
 await verifyMedia(store,scope,cloud(),[id]);assert.equal((await readCatalog(store,'film')).assets[0].remote!.availability,'available');
});
test('aborts on account/project switch and never mixes another account with the same asset id',async()=>{
 const store=memoryVault();let current=true;
 await assert.rejects(syncPage(store,{...scope,current:()=>current},cloud({list:async()=>{current=false;return {assets:[row],hasMore:false,nextOffset:1};}})),/changed/);
 assert.equal((await readCatalog(store,'film')).assets.length,0);
 const c=mergeRemote(mergeRemote(emptyCatalog('film'),account,[row]),'b'.repeat(64),[row]);assert.equal(c.assets.length,2);
});
test('simulated generation registers job/output and local file before clearing a recovery receipt',async()=>{
 const store=memoryVault();await store.put({path:'Projets/film/Cast/alice.png',blob:new Blob(['png'],{type:'image/png'}),updatedAt:1});
 const receipt:PendingRender={version:1,kind:'cast',project:'film',id:'alice',name:'Alice',at:'2026-10-21T00:00:00Z',account,refs:[],template:'real-template',quote:2,balanceBefore:100,jobId:'job-12345678',prompt:'Alice'};
 const detail={status:'success',outputs:{save:{images:[{filename:'E*NKI.png',subfolder:'',type:'output'}]}}};
 await registerRender(store,receipt,detail,account);await registerRender(store,receipt,detail,account);
 let c=await readCatalog(store,'film');assert.equal(c.assets.length,1);assert.equal(c.assets[0].localPath,'Projets/film/Cast/alice.png');assert.equal(c.assets[0].cost,null);
 c=mergeRemote(c,account,[row]);assert.equal(c.assets.length,1);assert.equal(c.assets[0].remote!.assetId,uuid);assert.equal(c.assets[0].organization.character,'Alice');
});
test('catalog rejects traversal and foreign-project manifests, marks known asset expiry separately from URL expiry',()=>{
 const c=mergeRemote(emptyCatalog('film'),account,[parseRemoteAsset({...raw,expires_at:'2020-01-01T00:00:00Z',url_expires_at:'2019-01-01T00:00:00Z'})]);assert.equal(c.assets[0].remote!.availability,'expired');
 assert.throws(()=>parseCatalog(JSON.stringify(c),'other'));c.assets[0].localPath='Projets/film/../private';assert.throws(()=>parseCatalog(JSON.stringify(c),'film'));
 assert.equal(mergeRemote(emptyCatalog('film'),account,[parseRemoteAsset({...raw,url_expires_at:'2019-01-01T00:00:00Z'})]).assets[0].remote!.availability,'available');
});
test('media transport uses GET-only same-origin endpoints, caps downloads, and never follows auth redirects',async()=>{
 const requests:{url:string,init?:RequestInit}[]=[];
 const client=createMediaClient({kind:'key',key:'comfy-secret'},async(input,init)=>{requests.push({url:String(input),init});return String(input).includes('/content')?new Response('oversize',{headers:{'content-type':'image/png'}}):Response.json({assets:[raw],has_more:false});});
 assert.equal((await client.list(0)).assets[0].id,uuid);await assert.rejects(client.content(uuid,2),/size/);
 for(const r of requests){assert.ok(r.url.startsWith('/api/'));assert.equal(r.init?.redirect,'error');assert.equal(r.init?.method,undefined);assert.equal(new Headers(r.init?.headers).get('x-api-key'),'comfy-secret');}
 await assert.rejects(client.content('../private'),/invalid/);
});
test('scope remains opaque and key-specific when v1 user exposes only status',async()=>{
 const a=createRenderClient({auth:{kind:'key',key:'secret-a'}});const b=createRenderClient({auth:{kind:'key',key:'secret-b'}});
 const scopeA=await accountScope({status:'active'},await renderCredentialScope(a));const scopeB=await accountScope({status:'active'},await renderCredentialScope(b));assert.notEqual(scopeA,scopeB);assert.match(scopeA,/^[a-f0-9]{64}$/);await assert.rejects(accountScope({status:'active'}));
});

test('concurrent metadata writers preserve both changes even through different vault wrappers',async()=>{
 const store=memoryVault();await syncPage(store,scope,cloud());const id=(await readCatalog(store,'film')).assets[0].id;
 await Promise.all([
   updateCatalog({...store},'film',c=>classify(c,[id],{sequence:'F'})),
   updateCatalog({...store},'film',c=>classify(c,[id],{character:'E*NKI'})),
 ]);
 const asset=(await readCatalog(store,'film')).assets[0];assert.equal(asset.organization.sequence,'F');assert.equal(asset.organization.character,'E*NKI');
});

test('multiple render outputs keep distinct identities and only the saved output is cached',async()=>{
 const store=memoryVault();await store.put({path:'Projets/film/Cast/alice.png',blob:new Blob(['first'],{type:'image/png'}),updatedAt:1});
 const receipt:PendingRender={version:1,kind:'cast',project:'film',id:'alice',name:'Alice',at:'2026-10-21T00:00:00Z',account,refs:[],template:'real-template',quote:2,balanceBefore:100,jobId:'job-12345678',prompt:'Alice'};
 const detail={status:'success',outputs:{save:{images:[{filename:'first.png',subfolder:'',type:'output'},{filename:'second.png',subfolder:'',type:'output'},{filename:'third.png',subfolder:'',type:'output'}]}}};
 await registerRender(store,receipt,detail,account);await registerRender(store,receipt,detail,account);
 const catalog=await readCatalog(store,'film');assert.equal(catalog.assets.length,3);assert.equal(catalog.assets.filter(a=>a.localPath).length,1);
 const render={file:async(ref:{filename:string})=>new Blob([ref.filename],{type:'image/png'})};
 const second=await cacheMedia(store,scope,cloud(),render,catalog.assets[1].id);const third=await cacheMedia(store,scope,cloud(),render,catalog.assets[2].id);
 assert.notEqual(second,third);assert.equal(await (await store.get(second))!.blob!.text(),'second.png');assert.equal(await (await store.get(third))!.blob!.text(),'third.png');
});

test('remote cancellation requires confirmation and exact receipt/account, preserves recovery on failure or success',async()=>{
 const receipt:PendingRender={version:1,kind:'cast',project:'film',id:'alice',name:'Alice',at:'2026-10-21T00:00:00Z',account,refs:[],template:'real-template',quote:2,balanceBefore:100,jobId:'job-12345678',prompt:'Alice'};
 const data=new Map([[PENDING_RENDER_KEY,JSON.stringify(receipt)]]);const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
 let calls=0;const client={cancel:async()=>{calls++;}};
 await assert.rejects(cancelPendingJob(storage,client,account,receipt.jobId!,false),/confirm/);
 await assert.rejects(cancelPendingJob(storage,client,'wrong-account',receipt.jobId!,true),/account/);
 await assert.rejects(cancelPendingJob(storage,client,account,'another-job',true),/changed/);assert.equal(calls,0);
 await assert.rejects(cancelPendingJob(storage,{cancel:async()=>{throw Error('offline');}},account,receipt.jobId!,true),/offline/);assert.ok(data.has(PENDING_RENDER_KEY));
 await cancelPendingJob(storage,client,account,receipt.jobId!,true);assert.equal(calls,1);assert.equal(data.get(PENDING_RENDER_KEY),JSON.stringify(receipt));
});

test('render recovery preserves resolved remote identity, links source assets, and backfills only missing organization',async()=>{
 const store=memoryVault();const source='Projets/film/Cast/reference.png';const output='Projets/film/Prises/take-1.mp4';
 await store.put({path:source,blob:new Blob(['image'],{type:'image/png'}),updatedAt:1});await store.put({path:output,blob:new Blob(['video'],{type:'video/mp4'}),updatedAt:2});
 const receipt:PendingRender={version:1,kind:'take',project:'film',id:'take-1',name:'Laboratoire',at:'2026-10-21T00:00:00Z',account,refs:[source,'Projets/other/Cast/private.png'],template:'real-template',quote:2,balanceBefore:100,jobId:'job-12345678',prompt:'Alice'};
 const detail={status:'success',outputs:{save:{images:[{filename:'take.mp4',subfolder:'',type:'output'}]}}};
 await registerRender(store,receipt,detail,account);
 await updateCatalog(store,'film',c=>mergeRemote(c,account,[parseRemoteAsset({...raw,name:'take.mp4',mime_type:'video/mp4'})]));
 let catalog=await readCatalog(store,'film');const outputId=catalog.assets.find(a=>a.localPath===output)!.id;
 await updateCatalog(store,'film',c=>classify(c,[outputId],{sequence:'F',character:'Alice'}));
 await registerRender(store,receipt,detail,account);
 catalog=await discoverLocal(store,'film',{[output]:{name:'Laboratoire',sequence:'G',decor:'Labo réel',take:'take-1'}});
 const asset=catalog.assets.find(a=>a.id===outputId)!;
 assert.equal(catalog.assets.length,2);assert.equal(asset.remote!.assetId,uuid);assert.deepEqual(asset.relations,[`local:${source}`]);
 assert.equal(asset.organization.sequence,'F');assert.equal(asset.organization.character,'Alice');assert.equal(asset.organization.decor,'Labo réel');assert.equal(asset.organization.take,'take-1');
});
