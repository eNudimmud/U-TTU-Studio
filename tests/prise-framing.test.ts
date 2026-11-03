import assert from 'node:assert/strict';
import { test } from 'node:test';
import { framingSize, framingEdges, readFraming } from '../src/lib/maquette/framing.ts';
import { emptyPlan } from '../src/lib/prise/decision.ts';
import { planJson, planFromJson } from '../src/lib/prise/vault.ts';
import { takeGraphFor, submitTake } from '../src/lib/render/run.ts';
import { takeProfile, isApercuProfile } from '../src/lib/render/take-graph.ts';
import { resolveTakeQuote } from '../src/lib/render/billed-quote.ts';

import type { RenderClient } from '../src/lib/render/client.ts';

const frame = {version:1 as const, source:'3d' as const, width:1280,height:720,color:'Projets/test/Assets/cadre-color.png',depth:'Projets/test/Assets/cadre-depth.png',edges:'Projets/test/Assets/cadre-edges.png'};
const settings = {engine:'ltx' as const, quality:'rapide' as const, seconds:5 as const, aspect:'horizontal' as const, cadrage:'depth-edges-v1' as const};

test('framing: immutable asset references survive shot serialization; corrupt maps are refused',()=>{
 assert.deepEqual(planFromJson(planJson({...emptyPlan(),framing:frame}),emptyPlan()).framing,frame);
 assert.deepEqual(framingSize('16:9'),{width:1280,height:720});
 assert.deepEqual(framingSize('9:16'),{width:720,height:1280});
 for(const change of [{depth:frame.edges},{width:999},{depth:'https://example.com/depth.png'},{source:'depth'},{camera:{fov:NaN,near:0,far:1,world:[],projection:[]}}]) assert.equal(readFraming({...frame,...change}),undefined);
});

test('framing: contours mark a silhouette boundary and leave a constant plane black',()=>{
 const pixels=new Uint8ClampedArray(12*12*4);
 for(let y=0;y<12;y++)for(let x=0;x<12;x++){const i=(y*12+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=x>=6?255:0;pixels[i+3]=255;}
 const edge=framingEdges(pixels,12,12);
 assert.equal(edge[(6*12+5)*4],255);
 assert.equal(edge[(6*12+2)*4],0);
 assert.throws(()=>framingEdges(pixels,2,2));
});

test('framing: last key-image pass receives only native maps as depth/edge controls; LTX receives that decode',()=>{
 const graph=takeGraphFor(settings,'Léa walks; same face and place',['actor.png','set.png'],42,{depth:'native-depth.png',edges:'native-edges.png'});
 const depth=graph['control_111:85']; const edges=graph.control_edges_apply;
 assert.equal(depth.class_type,'ControlNetApplyAdvanced');
 assert.deepEqual(depth.inputs.image,['control_depth',0]);
 assert.equal(depth.inputs.strength,1); assert.equal(depth.inputs.end_percent,1);
 assert.deepEqual(edges.inputs.image,['control_edges',0]);
 assert.deepEqual(edges.inputs.positive,['control_111:85',0]);
 assert.equal(edges.inputs.end_percent,1); assert.equal(edges.inputs.strength,.8);
 assert.deepEqual(graph['control_111:3'].inputs.positive,['control_edges_apply',0]);
 assert.equal(graph['control_111:3'].inputs.denoise,.55);
 assert.doesNotMatch(graph['control_111:6'].inputs.text as string,/first frame|no text|no mannequins|control/i,'Qwen draws instruction sentences as captions');
 assert.equal(graph.control_guide,undefined);
 assert.deepEqual(graph.control_initial.inputs.image,['frame_decode',0]);
 assert.equal(graph.control_depth.inputs.image,'native-depth.png');
 assert.equal(graph.control_edges.inputs.image,'native-edges.png');
 assert.deepEqual(graph['398:351'].inputs.input,['control_111:8',0]);
 const uses=Object.values(graph).filter(n=>Object.values(n.inputs).some(v=>Array.isArray(v)&&v[0]==='control_111:8'));
 assert.ok(uses.length>=2,'video plus saved key image');
 assert.doesNotMatch(JSON.stringify(graph),/lotus-depth|LotusConditioning/);
});

test('framing: the colour preview reaches Klein as a layout guide after the identity references, never as a control',()=>{
 const graph=takeGraphFor(settings,'Léa walks',['actor.png','a2.png','a3.png','set.png'],42,{depth:'d.png',edges:'e.png',guide:'guide.png'});
 assert.equal(graph.control_guide.inputs.image,'guide.png');
 const klein=JSON.stringify(Object.values(graph).filter(n=>n.class_type==='ReferenceMultiLatent'||/Reference/.test(n.class_type)));
 assert.match(klein,/control_guide/);
 assert.match(JSON.stringify(graph),/Use <ref_image_4> only as the camera and layout guide/);
 assert.doesNotMatch(JSON.stringify(graph['control_111:85'].inputs)+JSON.stringify(graph.control_edges_apply.inputs),/control_guide/);
});

test('framing: a new estimated profile cannot reuse an ordinary take measurement',()=>{
 const profile=takeProfile(settings);
 assert.equal(profile,'ltx25-cadre-v1-5s-horizontal');
 const quote=resolveTakeQuote(profile,[]);
 assert.equal(quote.source,'estimated');
 if(quote.source==='estimated') {assert.equal(quote.estimate.credits,26);assert.equal(quote.estimate.creditsHigh,43);}
 const preview=takeProfile({...settings,rendu:'apercu'});
 assert.equal(isApercuProfile(preview),true);
 assert.equal(resolveTakeQuote(preview,[]).source,'estimated');
 assert.throws(()=>takeGraphFor(settings,'walk',['actor.png'],1),/cadrage/);
 assert.throws(()=>takeGraphFor({...settings,engine:'h3'},'walk',['actor.png'],1,{depth:'d.png',edges:'e.png'}),/cadrage/);
});

test('framing: missing controls stop before any upload or submission',async()=>{
 let calls=0; const client={upload:async()=>{calls++;return 'x.png';},submit:async()=>{calls++;return 'job';}} as unknown as RenderClient;
 await assert.rejects(()=>submitTake(client,{settings,prompt:'walk',pictures:[{blob:new Blob(['x']),name:'actor.png'}],seed:0,clientId:'x'},()=>{}),/incomplets/);
 assert.equal(calls,0);
});

test('framing: four identity references and two controls upload once in separate roles',async()=>{
 const names:string[]=[]; let sent=0;
 const client={upload:async(_blob:Blob,name:string)=>{names.push(name);return `uploaded-${name}`;},submit:async(graph:ReturnType<typeof takeGraphFor>)=>{sent++;assert.equal(graph.control_guide.inputs.image,'uploaded-guide.png');assert.equal(graph.control_depth.inputs.image,'uploaded-depth.png');assert.equal(graph.control_edges.inputs.image,'uploaded-edges.png');assert.equal(Object.keys(graph).filter(id=>/^picture_/.test(id)).length,4);return 'one-job';}} as unknown as RenderClient;
 const picture=(name:string)=>({name,blob:new Blob(['png'],{type:'image/png'})});
 const id=await submitTake(client,{settings,prompt:'walk',pictures:['a.png','b.png','c.png','d.png'].map(picture),controls:{depth:picture('depth.png'),edges:picture('edges.png'),guide:picture('guide.png')},seed:1,clientId:'test'},()=>{});
 assert.equal(id,'one-job');assert.equal(sent,1);assert.deepEqual(names,['a.png','b.png','c.png','d.png','depth.png','edges.png','guide.png']);
});
