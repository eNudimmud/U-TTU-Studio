import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudio } from '../src/lib/coffre/model.ts';
import { studioActionRegistry } from '../src/lib/agent/registry.ts';
import { productionContext } from '../src/lib/agent/context.ts';
import { prepareStep, parseAgentDraft } from '../src/lib/agent/execution.ts';
import { emptyConversation, makePlan, productionTurn, updateStep, refreshPlan, restoreConversation } from '../src/lib/agent/kernel/production.ts';
import { handleSemantic } from '../src/lib/agent/semantic-handler.ts';
import { proxyComfy } from '../src/lib/comfy-proxy.ts';
import type { StudioSession } from '../src/components/app/studio-session.tsx';

function session() {
 const files=new Map<string,string>();const studio={...emptyStudio(),project:'film',projectName:'Film'};let requests=0;
 const s={studio,cast:[],decor:[],loose:[],media:{},prefs:{},readProjectFile:async(p:string)=>files.get(p),writeProjectFile:async(p:string,t:string)=>{files.set(p,t);},refreshStudio:async()=>{},exportCoffre:async()=>{},setSheet:()=>{},sendSequence:async()=>0,createCast:async()=>{requests++;},runOutil:async()=>{requests++;}} as unknown as StudioSession;
 return {s,files,requests:()=>requests};
}
test('registry covers every Studio area and leaves unsupported Core/LoRA disabled',()=>{
 const ops=studioActionRegistry();for(const area of ['cast','decor','prise','montage','outils','coffre','projets'])assert.ok(ops.some(op=>op.area===area));
 assert.equal(ops.find(op=>op.id==='local:lora')!.status,'disabled');assert.equal(ops.find(op=>op.id==='local:core')!.status,'disabled');
 assert.ok(ops.filter(op=>op.id.startsWith('tool:')&&op.status==='ready').every(op=>op.href&&op.toolId));
});
test('bridge prepares three linked drafts idempotently with zero paid method calls',async()=>{
 const {s,files,requests}=session();const context=productionContext(s,studioActionRegistry(),[]);
 const plan=makePlan('Prépare trois prises dans le laboratoire',['local:shots'],context,1);
 const result=await prepareStep(s,context,plan,plan.steps[0]);assert.equal(result.results.length,3);assert.equal(files.size,3);assert.equal(result.state,'done');
 files.set(`Shots/${result.results[0]}.md`,'user edit');await prepareStep(s,context,plan,plan.steps[0]);assert.equal(files.size,3);assert.equal(files.get(`Shots/${result.results[0]}.md`),'user edit');assert.equal(requests(),0);
 const foreign={...context,projectId:'other'};await assert.rejects(prepareStep(s,foreign,plan,plan.steps[0]));
});
test('handoff validates project, catalogue and resources, never an arbitrary path',async()=>{
 const {s,files,requests}=session();const c=productionContext(s,studioActionRegistry(),[]);const p=makePlan('Créer Alice',['local:cast'],c,1);const result=await prepareStep(s,c,p,p.steps[0]);assert.equal(result.state,'prepared');
 const raw=files.get('.uttu/agent-draft.json');assert.ok(parseAgentDraft(raw,c));assert.equal(parseAgentDraft(raw,{...c,projectId:'other'}),null);
 assert.equal(parseAgentDraft(JSON.stringify({...JSON.parse(raw!),resourceIds:['/private/key']}),c),null);assert.equal(requests(),0);
});
test('full production plan preserves validated steps across backup/reopen and does not treat preparation as completion',()=>{
 const {s}=session();const c=productionContext(s,studioActionRegistry(),[]);let conversation=productionTurn(emptyConversation('film'),'Un court-métrage complet dans le laboratoire',c,{at:1});
 for(const step of conversation.plan!.steps){let plan=refreshPlan(conversation.plan!,c);assert.equal(plan.steps.find(s=>s.id===step.id)!.state,'ready');plan=updateStep(plan,step.id,{state:'prepared'});conversation={...conversation,plan};conversation=restoreConversation(JSON.stringify(conversation),c);assert.equal(conversation.plan!.steps.find(s=>s.id===step.id)!.state,'prepared');conversation.plan=updateStep(conversation.plan!,step.id,{state:'done',results:[`simulated-receipt:${step.operationId}`]});}
 assert.ok(restoreConversation(JSON.stringify(conversation),c).plan!.steps.every(s=>s.state==='done'));
});
test('semantic route refuses unconfirmed/cross-origin calls before any provider request',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json({});};
 for(const headers of [new Headers({origin:'https://studio.test'}),new Headers({origin:'https://evil.test','x-studio-model-confirmed':'yes'})]){const r=await handleSemantic(new Request('https://studio.test/studio-agent/interpret',{method:'POST',headers,body:'{}'}),fetcher);assert.equal(r.status,403);}assert.equal(calls,0);
});
test('semantic call sends allowlisted context only, rejects arbitrary actions and leaks no Comfy credentials',async()=>{
 let calls=0;const fetcher:typeof fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer typesafe-test-key');assert.doesNotMatch(String(init?.body),/comfy-secret|private-file|evil\.test/);return Response.json({answers:{step1:{type:'choice',choice:'shell:run',confidence:1}}});};
 const r=await handleSemantic(new Request('https://studio.test/studio-agent/interpret',{method:'POST',headers:{origin:'https://studio.test','content-type':'application/json','x-studio-model-confirmed':'yes','x-typesafe-key':'typesafe-test-key'},body:JSON.stringify({message:'prépare un film',project:'film',key:'comfy-secret',url:'https://evil.test',resources:[{id:'private-file',name:'private-file',kind:'image'}]})}),fetcher);
 assert.equal(r.status,200);assert.equal((await r.json()).interpretation,null);assert.equal(calls,1);
});
test('v2 content redirects are streamed without forwarding credentials to storage',async()=>{
 const calls:{url:string,headers:Headers}[]=[];
 const response=await proxyComfy(new Request('https://studio.test/api/v2/assets/12345678-1234-4234-8234-123456789abc/content',{headers:{'x-api-key':'comfy-secret',authorization:'Bearer session-secret'}}),async(url,init)=>{calls.push({url:String(url),headers:new Headers(init?.headers)});return calls.length===1?new Response(null,{status:302,headers:{location:'https://storage.googleapis.com/bucket/file?signed=temporary'}}):new Response('png',{headers:{'content-type':'image/png'}});});
 assert.equal(await response!.text(),'png');assert.equal(calls.length,2);assert.equal(calls[1].headers.get('x-api-key'),null);assert.equal(calls[1].headers.get('authorization'),null);assert.equal(calls[1].headers.get('cookie'),null);
});
