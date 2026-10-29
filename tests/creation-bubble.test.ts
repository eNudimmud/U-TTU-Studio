import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUBBLE_DEFAULTS, bubbleGraph, bubblePrompt, bubbleQuote, bubbleSize } from '../src/lib/creation/bubble.ts';
import { namedReferenceNote, readNamedReferences, referenceFromNote } from '../src/lib/creation/named-references.ts';
import { memoryVault } from '../src/lib/coffre/store.ts';
import { castNote } from '../src/lib/creation/fiche.ts';
import { readFrontmatter } from '../src/lib/coffre/markdown.ts';
import { DEFAULT_SETTINGS } from '../src/lib/barre/model.ts';
import { append, emptyFil, loadFil, planSend, projectFilStore, saveFil, type FilJob } from '../src/lib/barre/thread.ts';

test('one catalogue reads existing CAST and DÉCOR notes and the object/style references, scoped to a project', async () => {
  const vault = memoryVault(), images = ['Projets/film/Cast/sujet-a-1.png','Projets/film/Cast/sujet-a-2.png','Projets/film/Cast/sujet-a-3.png'];
  const source = castNote({ id:'sujet-a', name:'Sujet A', at:'2026-10-28T10:00:00Z', prompt:'Manteau sombre', source:'photos', photos:images, sheet:images[0], template:'image_flux3_klein_image_edit', quote:4, cost:3.57, project:'film' });
  const edited = namedReferenceNote('film','sujet-a',{name:'Sujet A modifié',description:'Même visage',category:'cast',images,preview:images[0]},source);
  const fields = readFrontmatter(edited).fields;
  assert.equal(fields.cout,3.57);assert.equal(fields.template,'image_flux3_klein_image_edit');
  await vault.put({path:'Projets/film/Cast/sujet-a.md',text:edited,updatedAt:1});
  await vault.put({path:'Projets/autre/Cast/sujet-a.md',text:source,updatedAt:1});
  for (const category of ['decor','objet','style'] as const) {
    const image=`Projets/film/Refs/${category}.png`;
    await vault.put({path:`Projets/film/${category==='decor'?'Decors':'Refs'}/${category}.md`,text:namedReferenceNote('film',category,{name:category,description:'Une référence',category,images:[image],preview:image}),updatedAt:1});
  }
  const refs=await readNamedReferences(vault,'film');assert.equal(refs.length,4);
  assert.deepEqual(refs.find(r=>r.id==='sujet-a')?.images,images);
  assert.equal(refs.find(r=>r.id==='sujet-a')?.name,'Sujet A modifié');
  assert.equal(referenceFromNote('Projets/autre/Cast/sujet-a.md',source,'film'),null);
  assert.throws(()=>namedReferenceNote('film','bad',{name:'',description:'',category:'cast',images,preview:images[0]}));
  assert.throws(()=>namedReferenceNote('film','bad',{name:'Bad',description:'',category:'cast',images:['Projets/autre/Refs/x.png'],preview:images[0]}));
});

test('seven named references reach Klein without truncation, and its canvas follows the chosen format', () => {
  const settings={...BUBBLE_DEFAULTS,format:'9:16' as const,resolution:'720p' as const};
  const images=Array.from({length:7},(_,i)=>`ref-${i}.png`);
  const graph=bubbleGraph({mode:'image',settings,images,prompt:'Sujet A et Sujet B au quai',seed:42});
  for(let i=0;i<7;i++)assert.deepEqual(graph.image_17.inputs[`images.image${i}`],[`reference_${i+1}`,0]);
  assert.equal(Object.values(graph).filter(n=>n.class_type==='LoadImage').length,7);
  assert.deepEqual(graph.image_7.inputs.latent_image,['canvas',0]);
  assert.equal(graph.canvas.inputs.width,bubbleSize(settings).width);
  assert.equal(graph.canvas.inputs.height,bubbleSize(settings).height);
  const prompt=bubblePrompt('Sujet A et Sujet B',[{name:'Sujet A',description:'manteau sombre'},{name:'Sujet B'}],'image');
  assert.match(prompt,/<ref_image_0>: "Sujet A"/);assert.match(prompt,/<ref_image_1>: "Sujet B"/);
  assert.throws(()=>bubbleGraph({mode:'image',settings,images:[...images,'8.png'],prompt:'test',seed:1}));
});

test('video references, duration, sound and audio are wired to the official H3 inputs',()=>{
  const settings={...BUBBLE_DEFAULTS,duration:10 as const,sound:false};
  const graph=bubbleGraph({mode:'video',settings,images:['sujet-a.png','sujet-b.png'],audio:'voix.wav',prompt:'<Picture 1> et <Picture 2> marchent',seed:42});
  assert.equal(graph['136'].class_type,'MiniMaxH3ReferenceToVideo');
  assert.deepEqual(graph['136'].inputs['ref_images.ref_image_1'],['reference_2',0]);
  assert.deepEqual(graph['136'].inputs['ref_audios.ref_audio_0'],['reference_audio',0]);
  assert.equal(graph['132'].inputs.value,10);assert.equal(graph['130'].inputs.audio,undefined);
  const withSound=bubbleGraph({mode:'video',settings:{...settings,sound:true},images:['sujet-a.png'],prompt:'marche',seed:42});
  assert.ok(withSound['130'].inputs.audio);
});

test('prompt alone uses the existing text templates and estimates increase with the actual choices',()=>{
  const still=bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:[],prompt:'un quai',seed:42});
  assert.equal(Object.values(still).filter(n=>n.class_type==='LoadImage').length,0);
  assert.deepEqual(still['image_18:7'].inputs.latent_image,['canvas',0]);
  const large=bubbleGraph({mode:'image',settings:{...BUBBLE_DEFAULTS,resolution:'720p'},images:[],prompt:'un quai',seed:42});
  assert.equal(large.canvas.inputs.width,bubbleSize({...BUBBLE_DEFAULTS,resolution:'720p'}).width);
  assert.equal(large.canvas.inputs.height,bubbleSize({...BUBBLE_DEFAULTS,resolution:'720p'}).height);
  const video=bubbleGraph({mode:'video',settings:{...BUBBLE_DEFAULTS,duration:10,sound:false,format:'1:1'},images:[],prompt:'Un quai sous la pluie',seed:42});
  assert.equal(video['405:362'].inputs.value,10);assert.match(String(video['409'].inputs.aspect_ratio),/1:1/);
  assert.ok(Object.values(video).every(n=>n.class_type!=='CreateVideo'||!n.inputs.audio));
  const low=bubbleQuote('video',2,BUBBLE_DEFAULTS)!;
  const high=bubbleQuote('video',2,{...BUBBLE_DEFAULTS,resolution:'720p',duration:10})!;
  assert.ok(high.credits>low.credits);assert.equal(low.kind,'estime');assert.ok(low.high>low.credits);
  assert.equal(bubbleQuote('image',8,BUBBLE_DEFAULTS),null);
});

test('the bubble never silently drops an eighth reference or an unreadable attachment',()=>{
  const base={mode:'image' as const,text:'Sujet A et Sujet B',settings:DEFAULT_SETTINGS,creation:{settings:BUBBLE_DEFAULTS},last:null,lastName:'Résultat'};
  const refs=Array.from({length:7},(_,i)=>({kind:'cast' as const,id:`r${i}`,name:`r${i}`,src:`/r${i}.png`}));
  const plan=planSend({...base,refs});assert.ok(plan.kind==='run'&&plan.refs.length===7);
  assert.deepEqual(planSend({...base,refs:[...refs,refs[0]]}),{kind:'note',key:'bubble.invalid'});
  assert.deepEqual(planSend({...base,refs:[{...refs[0],src:''}]}),{kind:'note',key:'namedRefs.missing'});
});

test('all new reference and bubble translations exist in the four languages',()=>{
  const flatten=(value:Record<string,unknown>,prefix=''):string[]=>Object.entries(value).flatMap(([key,v])=>typeof v==='object'&&v?flatten(v as Record<string,unknown>,`${prefix}${key}.`):[`${prefix}${key}`]);
  const keys=(lang:string)=>{const d=JSON.parse(readFileSync(`messages/${lang}.json`,'utf8'));return flatten({namedRefs:d.namedRefs,bubble:d.bubble}).sort();};
  for(const lang of ['en','de','es'])assert.deepEqual(keys(lang),keys('fr'));
});

test('project threads retain the submitted receipt across reload and cannot read another project',()=>{
  const map=new Map<string,string>();const store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
  const job:FilJob={id:'j1',of:'u1',role:'job',text:'un quai',route:{kind:'outil',id:'img-klein',images:[],creation:{mode:'image',settings:BUBBLE_DEFAULTS}},sortie:'image',status:'running',quote:2,aspect:'horizontal',jobId:'comfy-existing-job',renderId:'img-klein-example',project:'film'};
  saveFil(projectFilStore(store,'film'),append(emptyFil(),job));
  const back=loadFil(projectFilStore(store,'film')).messages[0] as FilJob;
  assert.equal(back.status,'interrupted');assert.equal(back.jobId,'comfy-existing-job');assert.equal(back.project,'film');
  assert.equal(loadFil(projectFilStore(store,'autre')).messages.length,0);
  assert.throws(()=>projectFilStore(store,'../autre'));
});
