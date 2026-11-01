import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUBBLE_DEFAULTS, bubbleGraph, bubblePictureCount, bubblePrompt, bubbleQuote, bubbleReferenceSlots, bubbleResolutionLabel, bubbleSize, bubbleStaging, bubbleStyle, chipReference } from '../src/lib/creation/bubble.ts';
import { insertMention, mentionedReferences, opensPicker, removeMention } from '../src/lib/creation/mentions.ts';
import { fileLikeName, namedReferenceNote, pickerReferences, readNamedReferences, referenceFromNote, type NamedReference } from '../src/lib/creation/named-references.ts';
import { importMedia } from '../src/lib/creation/import-media.ts';
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
  assert.equal(graph.canvas.inputs.width,bubbleSize(settings,'image').width);
  assert.equal(graph.canvas.inputs.height,bubbleSize(settings,'image').height);
  const prompt=bubblePrompt('Sujet A et Sujet B',[{name:'Sujet A',description:'manteau sombre'},{name:'Sujet B'}],'image');
  assert.match(prompt,/The first image named "Sujet A"/);assert.match(prompt,/The second image named "Sujet B"/);
  assert.match(prompt,/^Sujet A \(the subject from the first image, manteau sombre\) et Sujet B \(the subject from the second image\)/,'names in the request point at their pictures');
  assert.throws(()=>bubbleGraph({mode:'image',settings,images:[...images,'8.png'],prompt:'test',seed:1}));
});

test('JD 2026-10-30: an image with a cast sheet and two loose photos is ≥ 1 MP, reads every reference at 1 MP, names each by ordinal and lets the vision upsampler run',()=>{
  // Before: 864×480 canvas, every reference squeezed to 0.4 MP, `<ref_image_N>: "1000053068.png"` tokens and the upsampler switched off.
  assert.deepEqual(bubbleSize(BUBBLE_DEFAULTS,'image'),{width:1344,height:768,megapixels:1344*768/2**20});
  assert.deepEqual([bubbleSize({...BUBBLE_DEFAULTS,format:'9:16'},'image').width,bubbleSize({...BUBBLE_DEFAULTS,format:'1:1'},'image').width],[768,1024]);
  assert.ok(bubbleSize({...BUBBLE_DEFAULTS,resolution:'720p'},'image').megapixels>=1.9);
  assert.deepEqual(bubbleSize(BUBBLE_DEFAULTS),{width:864,height:480,megapixels:864*480/2**20},'video keeps its 480p canvas');
  assert.equal(bubbleResolutionLabel('image','480p'),'1 MP');assert.equal(bubbleResolutionLabel('video','480p'),'480p');
  const refs=[{name:'L’alien',category:'cast'},{name:'1000053068.png',category:'photo'},{name:'1000052926.png',category:'photo'}];
  const prompt=bubblePrompt('génère une photo de l’alien avec la créature, en train de jouer dans la nature',refs,'image');
  assert.match(prompt,/The first image named "L’alien": a character from the cast: keep this exact character/);assert.match(prompt,/character sheet\) still shows ONE character/);
  assert.match(prompt,/The second image: an attached photo/);assert.match(prompt,/The third image: an attached photo/);
  assert.doesNotMatch(prompt,/<ref_image|1000053068|\.png/);assert.match(prompt,/never merge two subjects into one/);
  const graph=bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:['a.png','b.png','c.png'],prompt,seed:1785575703});
  assert.deepEqual([graph.canvas.inputs.width,graph.canvas.inputs.height],[1344,768]);
  assert.equal(graph.image_17.inputs['resolution.megapixels'],1);
  assert.equal(graph.image_51.inputs.switch,false,'the template’s vision upsampler describes each picture by ordinal');
  for(let i=0;i<3;i++)assert.deepEqual(graph.image_17.inputs[`images.image${i}`],[`reference_${i+1}`,0]);
  assert.equal(graph.image_61.inputs.value,`${prompt}\n${bubbleStaging(graph.image_7.inputs.seed as number)}`,'the request, then this run\'s staging');
  assert.match(prompt,/Style: a real photograph/,'« une photo » is honoured');
  assert.equal(graph.image_7.inputs.cfg,3.5,'the base Klein checkpoint needs guidance; cfg 1 (left over from the distilled template) melts anatomy');
  assert.equal(graph.image_7.inputs.steps,50);
  assert.match(bubblePrompt('a',[{name:'Sujet A',category:'cast'}],'video'),/<Picture 1>: "Sujet A"/,'video prompts are unchanged');
  for(const name of ['1000052812','1000053068.png','IMG_2041','PXL_20261030_014500.jpg'])assert.ok(fileLikeName(name),name);
  for(const name of ['L’alien','Fennec','Planète rose','R2'])assert.ok(!fileLikeName(name),name);
});

test('the image estimate follows the measured Comfy Cloud cost of the job it sends',()=>{
  // 2026-10-30, rtx_pro_6000: 1344×768 + 3 refs at 1 MP + upsampler at cfg 3.5 = 38.5 GPU s ≈ 10.5 credits (job fef595a7).
  const three=bubbleQuote('image',3,BUBBLE_DEFAULTS)!;
  assert.equal(three.credits,11);assert.ok(three.high>=three.credits);
  assert.ok(bubbleQuote('image',0,BUBBLE_DEFAULTS)!.credits<three.credits);
  assert.ok(bubbleQuote('image',3,{...BUBBLE_DEFAULTS,resolution:'720p'})!.credits>three.credits);
});

test('the bubble picker offers only named references, once each; raw imports stay in the vault',async()=>{
  const vault=memoryVault();
  const sheet=new Blob([new Uint8Array([1,2,3])],{type:'image/png'}),other=new Blob([new Uint8Array([4,5,6])],{type:'image/png'});
  const file=(blob:Blob,name:string)=>new File([blob],name,{type:'image/png'});
  // JD's library: the same sheet imported twice under its camera name, a loose building photo, and a character imported twice as « Uttu ».
  await importMedia(vault,[file(sheet,'1000052812.png'),file(sheet,'1000052812.png')],'personnage');
  await importMedia(vault,[file(other,'1000052926.png')],'decor');
  await importMedia(vault,[file(other,'Uttu.png'),file(other,'Uttu.png')],'personnage');
  const project=(await vault.list()).find(e=>/^Projets\/[^/]+\/Cast\//.test(e.path))!.path.split('/')[1];
  const shot=`Projets/${project}/Cast/alien.png`;await vault.put({path:shot,blob:sheet,updatedAt:1});
  const saved=(id:string)=>vault.put({path:`Projets/${project}/Cast/${id}.md`,text:namedReferenceNote(project,id,{name:'L’alien',description:'',category:'cast',images:[shot],preview:shot}),updatedAt:1});
  await saved('alien');await saved('alien-bis');
  // An older bubble card (no `origine`) named by hand is kept; an older import still named after its file is hidden.
  const legacy=(id:string,name:string)=>castNote({id,name,at:'2026-10-01T00:00:00Z',prompt:'',source:'photos',photos:[shot],sheet:shot,template:'',quote:0,cost:0,project});
  await vault.put({path:`Projets/${project}/Cast/vieux.md`,text:legacy('vieux','Fennec'),updatedAt:1});
  await vault.put({path:`Projets/${project}/Cast/vieil-import.md`,text:legacy('vieil-import','1000053068'),updatedAt:1});
  const all=await readNamedReferences(vault,project);
  assert.equal(all.length,9,'nothing is deleted from the library itself');
  const picker=pickerReferences(all);
  assert.deepEqual(picker.map(r=>r.name),['Fennec','L’alien','L’alien','Uttu'],'two hand-saved cards stay; the double import of Uttu shows once');
  assert.ok(all.filter(r=>r.name==='L’alien').every(r=>r.hash&&r.hash===all.find(x=>x.name==='1000052812')!.hash),'same bytes, same hash');
  // Renaming an import in the Références box makes it a reference.
  const imported=all.find(r=>r.name==='1000052926')!;assert.equal(imported.pickable,false);
  const renamed=namedReferenceNote(project,imported.id,{name:'Le Capitole',description:'',category:'decor',images:imported.images,preview:imported.preview},(await vault.get(imported.note))!.text);
  assert.equal(readFrontmatter(renamed).fields.origine,'references');
  assert.equal(referenceFromNote(imported.note,renamed,project)!.pickable,true);
  // A CAST sheet generated by a template is a reference whatever its name.
  const generated=castNote({id:'gen',name:'1000052812',at:'',prompt:'',source:'photos',photos:[shot],sheet:shot,template:'image_flux3_klein_image_edit',quote:4,cost:3,project});
  assert.equal(referenceFromNote(`Projets/${project}/Cast/gen.md`,generated,project)!.pickable,true);
  const without:NamedReference[]=[{id:'x',name:'X',description:'',category:'cast',images:[],preview:'',note:'n'}];assert.deepEqual(pickerReferences(without),[],'no picture, nothing to attach');
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
  assert.equal(large.canvas.inputs.width,bubbleSize({...BUBBLE_DEFAULTS,resolution:'720p'},'image').width);
  assert.equal(large.canvas.inputs.height,bubbleSize({...BUBBLE_DEFAULTS,resolution:'720p'},'image').height);
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

test('JD 2026-10-31: three named references (two characters, one DÉCOR) send every saved photo, the place sets the scene, and « une photo » stays a photo',()=>{
  // Before: each chip sent ONE local contact sheet (1536×1024, photos side by side + the name drawn on it): Kaya and the ship
  // reached Klein as sheets of sheets, shrunk to 1 MP, and the result was a generic cartoon on a generic ship.
  const enki={kind:'cast',name:'Enki',path:'Projets/p/Cast/enki.png',images:['Projets/p/Cast/enki.png']};
  const kaya={kind:'cast',name:'Kaya',description:'renard bleu-gris',path:'Projets/p/Cast/kaya-planche.png',images:['Projets/p/Cast/kaya-1.png','Projets/p/Cast/kaya-2.png']};
  const ship={kind:'decor',name:'Blanche Of Castille',description:'cité volante rouge au-dessus des nuages',path:'Projets/p/Decors/ship-planche.png',images:['Projets/p/Decors/s1.png','Projets/p/Decors/s2.png','Projets/p/Decors/s3.png']};
  const loadable=()=>true;
  const chips=[ship,enki,kaya].map(r=>chipReference(r,loadable));
  const slots=bubbleReferenceSlots(chips)!;
  assert.deepEqual(slots.map(s=>s.picture),['Projets/p/Cast/enki.png','Projets/p/Cast/kaya-1.png','Projets/p/Cast/kaya-2.png','Projets/p/Decors/s1.png','Projets/p/Decors/s2.png','Projets/p/Decors/s3.png'],'every photo, characters first, the place last, never a contact sheet');
  assert.equal(bubblePictureCount('image',chips),6);assert.equal(bubblePictureCount('video',chips),3,'video keeps one picture per chip');
  const text='génère une photo d’Enki qui Joue avec Kaya sur le pont du Blanche Of Castille';
  const prompt=bubblePrompt(text,chips,'image',slots);
  assert.match(prompt,/^génère une photo d’Enki \(the character from the first image\) qui Joue avec Kaya \(the character from the second and third images, renard bleu-gris\) sur le pont du Blanche Of Castille \(the place from the fourth to sixth images, cité volante rouge au-dessus des nuages\)/);
  assert.equal(bubblePrompt('@Enki joue avec @Kaya',chips,'image',slots).split('\n')[0],'Enki (the character from the first image) joue avec Kaya (the character from the second and third images, renard bleu-gris)','an @mention is bound to its chip');
  assert.match(prompt,/The fourth to sixth images named "Blanche Of Castille": the place where the scene happens: the new picture is set in or on this place, never in a generic one/);
  assert.match(prompt,/a deck, an interior, a street\), build that part in the same design/);
  assert.match(prompt,/\(cité volante rouge au-dessus des nuages\)/,'the saved description describes the place');
  assert.match(prompt,/The second and third images named "Kaya": a character from the cast/);
  assert.match(prompt,/Style: a real photograph.*Not a cartoon/);
  const graph=bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:slots.map((_,i)=>`u${i}.png`),prompt,seed:7});
  for(let i=0;i<6;i++){assert.deepEqual(graph.image_17.inputs[`images.image${i}`],[`reference_${i+1}`,0]);assert.deepEqual(graph.image_50.inputs[`images.image${i}`],[`reference_${i+1}`,0]);}
  assert.equal(graph.image_17.inputs['resolution.megapixels'],0.5,'six pictures share the same 3 MP as three');
  assert.equal(graph.style_note.class_type,'StringConcatenate');assert.deepEqual(graph.style_note.inputs.string_a,['image_51',0]);
  assert.deepEqual(graph.image_4.inputs.text,['style_note',0],'the photo style is said again after the upsampler');
  assert.match(String(graph.image_58.inputs.text),/cartoon, illustration/,'cfg 3.5 reads a negative prompt');
  assert.equal(graph.image_7.inputs.cfg,3.5);
  assert.ok(bubbleQuote('image',6,BUBBLE_DEFAULTS)!.credits>bubbleQuote('image',3,BUBBLE_DEFAULTS)!.credits,'same reference area, but every extra picture is read and costs');
});

test('the style intent is read in four languages and an asked-for drawing is never forced into a photo',()=>{
  for(const t of ['une photo de','a photograph of','ein Foto von','una fotografía de','réaliste','realistic','cinématique'])assert.equal(bubbleStyle(t),'photo',t);
  for(const t of ['un dessin de','a cartoon of','eine Zeichnung','un dibujo','style anime','a watercolour'])assert.equal(bubbleStyle(t),'drawn',t);
  assert.equal(bubbleStyle('Sujet A au quai'),null);
  const drawn=bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:['a.png'],prompt:bubblePrompt('un dessin de Sujet A',[{name:'Sujet A',category:'cast'}],'image'),seed:1});
  assert.equal(drawn.style_note,undefined);assert.equal(drawn.image_58.inputs.text,'');
  const open=bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:['a.png'],prompt:bubblePrompt('Sujet A au quai',[{name:'Sujet A',category:'cast'}],'image'),seed:1});
  assert.match(String(open.style_note.inputs.string_b),/keep the rendering of the reference images/);assert.equal(open.image_58.inputs.text,'');
});

test('seven pictures at most: each reference keeps one, the rest round-robin, and an eighth reference is refused with a message',()=>{
  const ref=(n:number,k='cast')=>({name:`R${n}`,category:k,pictures:[1,2,3].map(i=>`r${n}-${i}.png`)});
  const slots=bubbleReferenceSlots([ref(1),ref(2),ref(3,'decor')])!;
  assert.equal(slots.length,7);assert.deepEqual(slots.map(s=>s.ref),[0,0,0,1,1,2,2]);
  assert.equal(bubbleReferenceSlots(Array.from({length:7},(_,i)=>ref(i)))!.length,7);
  assert.equal(bubbleReferenceSlots(Array.from({length:8},(_,i)=>ref(i))),null);
  const fr=JSON.parse(readFileSync('messages/fr.json','utf8'));assert.match(fr.bubble.tooManyRefs,/sept au plus/);
  assert.deepEqual(chipReference({kind:'cast',name:'X',path:'p.png',images:['a.png','b.png']},p=>p==='b.png').pictures,['b.png'],'an unloadable photo is skipped');
  assert.deepEqual(chipReference({kind:'photo',name:'1.png',src:'/x.png'},()=>true).pictures,['/x.png'],'a loose photo or a house example sends what the chip shows');
});

test('@Name mentions: picking writes one, a lone @ opens the picker, a typed one binds the longest saved name, removing keeps the word',()=>{
  assert.deepEqual(insertMention('Une scène avec',"Sujet A"),{text:'Une scène avec @Sujet A ',caret:24});
  assert.equal(insertMention('avec @',"Sujet A",6).text,'avec @Sujet A ','the lone @ becomes the mention');
  assert.equal(insertMention('@sujet a rit','Sujet A').text,'@sujet a rit','never twice');
  assert.ok(opensPicker('avec ','avec @',6));assert.ok(!opensPicker('mail','mail@',5),'an e-mail is not a mention');
  assert.equal(removeMention('@Sujet A et @Sujet B','Sujet A'),'Sujet A et @Sujet B');
  const lib=[{name:'Ana'},{name:'Ana Maria'},{name:'Quai'}];
  assert.deepEqual(mentionedReferences('@Ana Maria au @Quai',lib).map(r=>r.name),['Ana Maria','Quai']);
  assert.deepEqual(mentionedReferences('@Anatole',lib),[],'whole names only');
});

test('JD 2026-10-31: with references, the image bubble composes on Nano Banana 2.1, one LoadImage per photo on its own numbered input, no batch, no upsampler', async () => {
  const { bubbleImageEngine, NANO_SHEET_RULE, NANO_SYSTEM_PROMPT } = await import('../src/lib/creation/bubble.ts');
  const { gesteParId } = await import('../src/lib/workflows/registre.ts');
  const chips=[
    {name:'Sujet A',category:'cast',description:'petit, logo sur le torse',pictures:['a1.png','a2.png','a3.png']},
    {name:'Lieu B',category:'decor',pictures:['b1.png','b2.png']},
    {name:'Sujet C',category:'cast',pictures:['c1.png','c2.png']},
  ];
  const slots=bubbleReferenceSlots(chips)!;
  assert.deepEqual(slots.map(s=>s.picture),['a1.png','a2.png','a3.png','c1.png','c2.png','b1.png','b2.png'],'cast first, place last');
  assert.equal(bubbleImageEngine('image',7,BUBBLE_DEFAULTS),'nano','with partner services on, Nano Banana is the default with references');
  assert.equal(bubbleImageEngine('image',0,BUBBLE_DEFAULTS),'klein','text-only stills stay on Klein');
  assert.equal(bubbleImageEngine('image',7,{...BUBBLE_DEFAULTS,engine:'klein'}),'klein','Klein is an explicit choice');
  assert.equal(bubbleImageEngine('image',7,BUBBLE_DEFAULTS,true),'klein','studio models only never reaches a partner node');
  assert.equal(bubbleImageEngine('video',7,BUBBLE_DEFAULTS),null);
  const prompt=bubblePrompt('@Sujet A et Sujet C jouent sur Lieu B, en photo',chips,'image',slots,'nano');
  assert.equal(prompt.split('\n')[0],'Sujet A (images 1 to 3) et Sujet C (images 4 and 5) jouent sur Lieu B (images 6 and 7), en photo');
  assert.match(prompt,/- Images 1 to 3: "Sujet A", character\. Keep this exact character.*petit, logo sur le torse\./);
  assert.match(prompt,/- Images 6 and 7: "Lieu B", place \(the setting\)\./);
  assert.ok(prompt.includes(NANO_SHEET_RULE),'a sheet of panels is never copied');
  assert.doesNotMatch(prompt,/Style: a real photograph|the first image/,'no forced style note, no Klein ordinals');
  const settings={...BUBBLE_DEFAULTS,format:'9:16' as const};
  const graph=bubbleGraph({mode:'image',settings,images:slots.map((_,i)=>`u${i}.png`),prompt,seed:9,engine:'nano'});
  const nano=graph.nano;
  assert.equal(nano.class_type,'GeminiNanoBanana2V2');
  assert.equal(nano.inputs.model,'Gemini Nano Banana 2.1');
  assert.equal(nano.inputs['model.aspect_ratio'],'9:16','the chosen frame, never auto');
  assert.equal(nano.inputs['model.resolution'],'1K');
  assert.equal(nano.inputs.system_prompt,NANO_SYSTEM_PROMPT);
  assert.equal(nano.inputs.prompt,prompt);
  for(let i=0;i<7;i++){assert.deepEqual(nano.inputs[`model.images.image_${i+1}`],[`reference_${i+1}`,0]);assert.equal(graph[`reference_${i+1}`].inputs.image,`u${i}.png`);}
  const classes=Object.values(graph).map(n=>n.class_type);
  assert.deepEqual(classes.filter(c=>c!=='LoadImage').sort(),['GeminiNanoBanana2V2','SaveImage']);
  assert.ok(!classes.some(c=>/Batch|TextGenerate|StringConcatenate|Klein|ReferenceMultiLatent/.test(c)));
  assert.deepEqual(graph.save.inputs.images,['nano',0]);
  assert.doesNotMatch(NANO_SYSTEM_PROMPT+NANO_SHEET_RULE,/Sujet|Lieu/,'the fixed rules carry no name');
  assert.equal(bubbleGraph({mode:'image',settings:{...BUBBLE_DEFAULTS,resolution:'720p'},images:['a.png'],prompt:'x',seed:1,engine:'nano'}).nano.inputs['model.resolution'],'2K');
  assert.equal(bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:['a.png'],prompt:'x',seed:1,engine:'klein'}).nano,undefined,'Klein path kept');
  const quote=bubbleQuote('image',7,BUBBLE_DEFAULTS,false,'nano')!;
  assert.deepEqual([quote.credits,quote.high,quote.kind],[12,15,'estime']);
  assert.equal(bubbleQuote('image',7,{...BUBBLE_DEFAULTS,resolution:'720p'},false,'nano')!.credits,17);
  assert.equal(gesteParId('creation-image-nano')?.template,'api_nano_banana_2_1_image_edit');
  assert.equal(gesteParId('creation-image-nano')?.partenaire,true);
});

test('JD 2026-10-31 evening: the Klein still with 7 pictures is quoted at the 14 credits it cost twice, and every run gets its own caption', async () => {
  const { UPSAMPLER_TOP_K } = await import('../src/lib/render/klein-graph.ts');
  // Job 96b0a72b (50.9 GPU s) and the next test: 1344×768 + 7 pictures + upsampler at cfg 3.5 = 14 credits each.
  assert.equal(bubbleQuote('image',7,BUBBLE_DEFAULTS)!.credits,14);
  assert.equal(bubbleQuote('image',3,BUBBLE_DEFAULTS)!.credits,11,'3 pictures stay at the measured 10.5 (fef595a7)');
  // Before: the upsampler decoded greedily (top_k 1, seed 0), so the same pictures always gave the same
  // caption, and every run drew the same pose whatever the sampler seed.
  const chips=[
    {name:'Sujet A',category:'cast',pictures:['a1.png','a2.png','a3.png']},
    {name:'Sujet C',category:'cast',pictures:['c1.png','c2.png']},
    {name:'Lieu B',category:'decor',pictures:['b1.png','b2.png']},
  ];
  const slots=bubbleReferenceSlots(chips)!;
  const prompt=bubblePrompt('Sujet A et Sujet C jouent sur Lieu B',chips,'image',slots,'klein');
  const run=(seed:number)=>bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:slots.map(s=>s.picture),prompt,seed,engine:'klein'});
  const a=run(1406790374), b=run(96585588);
  assert.equal(a.image_47.class_type,'TextGenerate');
  assert.deepEqual([a.image_47.inputs['sampling_mode.seed'],b.image_47.inputs['sampling_mode.seed']],[1406790374,96585588],'the caption follows the run seed');
  assert.equal(a.image_47.inputs['sampling_mode.top_k'],UPSAMPLER_TOP_K);assert.ok(UPSAMPLER_TOP_K>1,'never greedy');
  assert.deepEqual(a.image_7.inputs.seed,1406790374);
  // Nothing but the chips' own photos reaches the graph: no earlier result, no extra picture.
  const loads=Object.values(a).filter(n=>n.class_type==='LoadImage').map(n=>n.inputs.image);
  assert.deepEqual(loads,['a1.png','a2.png','a3.png','c1.png','c2.png','b1.png','b2.png']);
  assert.ok(!Object.values(a).some(n=>n.class_type==='LoadImage'&&!loads.includes(n.inputs.image as string)));
});

test('JD 2026-10-31 night: open weights only. The bubble never offers or points to a partner engine, and Qwen Image 2.1 reads each photo on its own', async () => {
  const { bubbleImageEngine, bubbleEngineChoices, qwenReferenceSide, POSE_RULE } = await import('../src/lib/creation/bubble.ts');
  const { DEFAULT_PREFS, prefsSession } = await import('../src/lib/studio-prefs.ts');
  const { gesteParId } = await import('../src/lib/workflows/registre.ts');
  const off=prefsSession(DEFAULT_PREFS).prefs, on=prefsSession({...DEFAULT_PREFS,partenaires:true}).prefs;
  assert.equal(bubbleImageEngine('image',7,BUBBLE_DEFAULTS,off.openWeightsOnly),'klein','the studio default stays open weights');
  assert.equal(bubbleImageEngine('image',7,{...BUBBLE_DEFAULTS,engine:'nano'},true),'klein','a saved Nano choice never reaches a partner node');
  assert.equal(bubbleImageEngine('image',7,{...BUBBLE_DEFAULTS,engine:'qwen'},true),'qwen');
  assert.equal(bubbleImageEngine('image',0,{...BUBBLE_DEFAULTS,engine:'qwen'},true),'klein','text-only stills stay on Klein t2i');
  assert.equal(bubbleImageEngine('image',7,BUBBLE_DEFAULTS,on.openWeightsOnly),'nano','the Nano path is kept, behind partner services');
  assert.deepEqual(bubbleEngineChoices(true),['klein','qwen','flux2']);
  assert.deepEqual(bubbleEngineChoices(false),['nano','klein','qwen','flux2']);
  assert.equal(gesteParId('creation-image-qwen')?.partenaire,false);
  assert.equal(gesteParId('creation-image-qwen')?.template,'image_qwen_image_2_1_image_edit');
  for(const lang of ['en','fr','de','es']){
    const m=JSON.parse(readFileSync(new URL(`../messages/${lang}.json`,import.meta.url),'utf8'));
    assert.equal(m.bubble.engineNeedsPartners,undefined,`${lang}: no call to turn partners on`);
    assert.doesNotMatch(m.bubble.engineStudioOnly,/Nano|partner|partenaire|Partner|asociad/i,`${lang}: a neutral line`);
    assert.ok(m.bubble.engineName.qwen&&m.bubble.engineHelp.qwen&&m.bubble.imageEngineQwen,`${lang}: Qwen is named`);
  }
  const bar=readFileSync(new URL('../src/components/app/creation-bar.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(bar,/engineNeedsPartners|data-barre-engine-fallback/);
  assert.match(bar,/bubbleEngineChoices\(prefs\.openWeightsOnly\)/,'the engine list comes from the open-weights filter');
  // Qwen graph: one LoadImage per photo on its own input, cast → place, no enhancer, fixed frame.
  const chips=[
    {name:'Sujet A',category:'cast',description:'petit, logo sur le torse',pictures:['a1.png','a2.png','a3.png']},
    {name:'Lieu B',category:'decor',pictures:['b1.png','b2.png']},
    {name:'Sujet C',category:'cast',pictures:['c1.png','c2.png']},
  ];
  const slots=bubbleReferenceSlots(chips)!;
  const prompt=bubblePrompt('@Sujet A et Sujet C jouent sur Lieu B',chips,'image',slots,'qwen');
  assert.equal(prompt.split('\n')[0],'Sujet A (<image1> <image2> <image3>) et Sujet C (<image4> <image5>) jouent sur Lieu B (<image6> <image7>)','the action stays verbatim, names point to their images');
  assert.match(prompt,/- <image6> <image7>: "Lieu B", place \(the setting\)\./);
  assert.ok(prompt.includes(POSE_RULE),'poses come from the request, never from the sheets');
  const graph=bubbleGraph({mode:'image',settings:{...BUBBLE_DEFAULTS,format:'9:16'},images:slots.map(s=>s.picture),prompt,seed:42,engine:'qwen'});
  const encode=graph['459:474'];
  assert.equal(encode.class_type,'TextEncodeQwenImage21');
  assert.equal(encode.inputs.prompt,prompt);
  for(let i=0;i<7;i++){assert.deepEqual(encode.inputs[`images.image_${i+1}`],[`reference_${i+1}`,0]);assert.equal(graph[`reference_${i+1}`].inputs.image,slots[i].picture);}
  assert.equal(encode.inputs.resolution,qwenReferenceSide(7));
  assert.equal(qwenReferenceSide(7),672,'7 pictures share 3 MP, like Klein');assert.equal(qwenReferenceSide(2),1024);
  const classes=Object.values(graph).map(n=>n.class_type);
  assert.ok(!classes.some(c=>/TextGenerate|Batch|PreviewAny|Gemini/.test(c)),'no prompt enhancer, no batch, no partner');
  assert.equal(graph['459:468'].inputs.switch,true,'the canvas is the chosen frame');
  assert.deepEqual([graph['459:456'].inputs.width,graph['459:456'].inputs.height],[768,1344]);
  assert.equal(graph['459:458'].inputs.seed,42);
  assert.deepEqual(graph.save.inputs.images,['459:457',0]);
  for(const [id,node] of Object.entries(graph)) for(const v of Object.values(node.inputs)) if(Array.isArray(v)&&typeof v[0]==='string') assert.ok(graph[v[0]],`${id} links to an existing node`);
  const q7=bubbleQuote('image',7,BUBBLE_DEFAULTS,false,'qwen')!, q1=bubbleQuote('image',1,BUBBLE_DEFAULTS,false,'qwen')!;
  assert.deepEqual([q7.credits,q7.high,q7.kind],[6,12,'estime']);
  assert.equal(q1.credits,3,'above the 2.01 measured for one reference (2ac9e65b)');
  // Klein keeps its path and also hears the pose rule (its upsampler reads the request).
  // JD 31.10.2026: same staging on every Klein run with nothing fixed but refs + text: each seed gets its own staging.
  const { BUBBLE_STAGINGS } = await import('../src/lib/creation/bubble.ts');
  const kp=bubblePrompt('Sujet A et Sujet C jouent sur Lieu B',chips,'image',slots,'klein');
  const k=(seed:number)=>String(bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:slots.map(s=>s.picture),prompt:kp,seed,engine:'klein'}).image_61.inputs.value);
  assert.ok(k(1406790374).startsWith(kp)&&k(1406790374).endsWith(bubbleStaging(1406790374)),'the request comes first, the staging after');
  assert.notEqual(bubbleStaging(1406790374),bubbleStaging(96585588));assert.notEqual(bubbleStaging(96585588),bubbleStaging(2049149149));
  assert.equal(new Set(Array.from({length:BUBBLE_STAGINGS.length},(_,i)=>bubbleStaging(i))).size,BUBBLE_STAGINGS.length);
  assert.match(bubbleStaging(5),/unless the request says otherwise/);
  assert.doesNotMatch(BUBBLE_STAGINGS.join(' '),/Sujet|Lieu|Enki|Fizz|Uttu/,'generic, no name');
  assert.equal(String(bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:[],prompt:'x',seed:3,engine:'klein'})['image_18:61']?.inputs.value ?? 'x'),'x','text-only stills are untouched');
  assert.ok(!String(graph['459:474'].inputs.prompt).includes('Staging for this picture'),'Qwen is untouched');
  const { NANO_SYSTEM_PROMPT } = await import('../src/lib/creation/bubble.ts');
  const { KLEIN_EDIT_BASE } = await import('../src/lib/render/klein-base.ts');
  for(const engine of ['klein','qwen','nano'] as const) assert.doesNotMatch(bubblePrompt('Sujet A et Sujet C jouent sur Lieu B',chips,'image',slots,engine)+NANO_SYSTEM_PROMPT,/\bstands?\b/i,`${engine}: no word imposes a standing pose`);
  const upsampler=String(KLEIN_EDIT_BASE['48'].inputs.value);
  assert.doesNotMatch(upsampler,/which pose/,'the upsampler never has to fix a pose');
  assert.match(upsampler,/Keep the action the user describes/);assert.match(upsampler,/never copy the pose a reference image shows/);
  assert.ok(bubblePrompt('Sujet A et Sujet C jouent sur Lieu B',chips,'image',slots,'klein').includes(POSE_RULE));
});

test('JD 2026-11-01: FLUX.2 dev is a third open engine, multi-reference from the official image_flux2 chain, price to be confirmed', async () => {
  const { bubbleImageEngine, bubbleEngineChoices, bubblePriceUnconfirmed, validBubbleSettings, POSE_RULE, FLUX2_REFERENCE_MEGAPIXELS } = await import('../src/lib/creation/bubble.ts');
  const { gesteParId } = await import('../src/lib/workflows/registre.ts');
  assert.equal(bubbleImageEngine('image',7,BUBBLE_DEFAULTS,true),'klein','Klein stays the default');
  assert.equal(bubbleImageEngine('image',7,{...BUBBLE_DEFAULTS,engine:'flux2'},true),'flux2');
  assert.equal(bubbleImageEngine('image',0,{...BUBBLE_DEFAULTS,engine:'flux2'},true),'klein','text-only stills stay on Klein t2i');
  assert.equal(bubbleEngineChoices(true)[0],'klein');
  assert.ok(validBubbleSettings({...BUBBLE_DEFAULTS,engine:'flux2'}));
  const row=gesteParId('creation-image-flux2');
  assert.equal(row?.template,'image_flux2');assert.equal(row?.partenaire,false);
  const chips=[
    {name:'Lieu B',category:'decor',pictures:['b1.png','b2.png']},
    {name:'Sujet A',category:'cast',pictures:['a1.png','a2.png','a3.png']},
    {name:'Objet D',category:'objet',pictures:['d1.png']},
    {name:'Sujet C',category:'cast',pictures:['c1.png']},
  ];
  const slots=bubbleReferenceSlots(chips)!;
  assert.deepEqual(slots.map(s=>s.picture),['a1.png','a2.png','a3.png','c1.png','d1.png','b1.png','b2.png'],'characters, then objects, then the place');
  const prompt=bubblePrompt('Sujet A et Sujet C jouent sur Lieu B',chips,'image',slots,'flux2');
  assert.ok(prompt.includes(POSE_RULE));
  const graph=bubbleGraph({mode:'image',settings:BUBBLE_DEFAULTS,images:slots.map(s=>s.picture),prompt,seed:96585588,engine:'flux2'});
  assert.equal(graph.unet.inputs.unet_name,'flux2_dev_fp8mixed.safetensors');
  assert.equal(graph.clip.inputs.type,'flux2');
  const text=String(graph.prompt.inputs.text);
  assert.ok(text.startsWith(prompt)&&text.includes(bubbleStaging(96585588)),'request first, then the seed\'s staging');
  let cond:unknown=graph.guider.inputs.conditioning;
  const order:string[]=[];
  while(Array.isArray(cond)&&String(cond[0]).startsWith('ref_')){const n=graph[cond[0] as string];const enc=graph[(n.inputs.latent as [string,number])[0]];const scale=graph[(enc.inputs.pixels as [string,number])[0]];assert.equal(scale.class_type,'ImageScaleToTotalPixels');assert.equal(scale.inputs.megapixels,FLUX2_REFERENCE_MEGAPIXELS);order.unshift(String(graph[(scale.inputs.image as [string,number])[0]].inputs.image));cond=n.inputs.conditioning;}
  assert.deepEqual(order,slots.map(s=>s.picture),'one ReferenceLatent per photo, chained in send order');
  assert.deepEqual(cond,['guidance',0]);
  assert.equal(graph.guidance.inputs.guidance,4);
  assert.deepEqual([graph.canvas.class_type,graph.canvas.inputs.width,graph.canvas.inputs.height],['EmptyFlux2LatentImage',1344,768],'the chosen frame, never a reference');
  assert.equal(graph.noise.inputs.noise_seed,96585588);
  assert.equal(graph.sigmas.inputs.steps,20);
  assert.ok(!Object.values(graph).some(n=>/TextGenerate|Gemini|Lora/.test(n.class_type)),'no upsampler, no partner, Turbo LoRA off');
  for(const [id,node] of Object.entries(graph)) for(const v of Object.values(node.inputs)) if(Array.isArray(v)&&typeof v[0]==='string') assert.ok(graph[v[0]],`${id} links to an existing node`);
  const q=bubbleQuote('image',7,BUBBLE_DEFAULTS,false,'flux2')!;
  assert.deepEqual([q.credits,q.high,q.kind],[50,100,'estime']);
  // First run (job d107aeb5): 1344×768 + 5 refs = 128 GPU s ≈ 35 credits. The quote at 5 refs stays above it.
  assert.ok(bubbleQuote('image',5,BUBBLE_DEFAULTS,false,'flux2')!.credits>=Math.ceil(128*0.001295*211),'never under the first billed run');
  assert.ok(q.credits>bubbleQuote('image',7,BUBBLE_DEFAULTS,false,'klein')!.credits*2,'a cautious upper estimate, well above Klein');
  assert.equal(bubblePriceUnconfirmed('image',7,'flux2'),true);
  assert.equal(bubblePriceUnconfirmed('image',7,'klein'),false);
  for(const lang of ['en','fr','de','es']){
    const m=JSON.parse(readFileSync(new URL(`../messages/${lang}.json`,import.meta.url),'utf8'));
    assert.ok(m.bubble.engineName.flux2&&m.bubble.engineHelp.flux2&&m.bubble.imageEngineFlux2&&m.bubble.priceUnconfirmed,`${lang}: FLUX.2 dev is named, its price flagged`);
    assert.doesNotMatch(JSON.stringify([m.bubble.engineHelp.flux2,m.bubble.priceUnconfirmed]),/gratuit|free|kostenlos|gratis/i);
  }
});
