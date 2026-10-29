import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/simulate-comfy';

test.use({hasTouch:true});
const photo={name:'uttu.webp',mimeType:'image/webp',buffer:readFileSync('public/images/uttu-portrait.webp')};
async function openLibrary(page:Page){await page.locator('[data-barre-plus]').tap();await page.locator('[data-barre-attach=reference]').tap();await expect(page.locator('[data-refs-sheet]')).toBeVisible();}
async function createRef(page:Page,name:string,count=1,category='cast'){
  await page.locator('[data-refs-new]').tap();
  await page.locator('[data-ref-name]').fill(name);await page.locator('[data-ref-category]').selectOption(category);
  await page.locator('[data-ref-photos]').setInputFiles(Array.from({length:count},(_,i)=>({...photo,name:`uttu-${i}.webp`})));
  await page.locator('[data-ref-save]').tap();await expect(page.locator('[data-ref-editor]')).toHaveCount(0);
}
async function screenshot(page:Page,name:string){if(process.env.CREATION_SHOTS_DIR){mkdirSync(process.env.CREATION_SHOTS_DIR,{recursive:true});await page.screenshot({path:join(process.env.CREATION_SHOTS_DIR,name)});}}

test('bibliothèque personnelle : formulaire vierge, plus de sept fiches et création possible même avec sept références jointes',async({page},info)=>{
  const paid:string[]=[];
  page.on('request',r=>{if(r.method()==='POST'&&/\/api\/(prompt|upload\/)/.test(r.url()))paid.push(r.url());});
  await page.goto('/studio');await openLibrary(page);
  await expect(page.locator('[data-ref]')).toHaveCount(0);
  await expect(page.locator('[data-refs-capacity]')).toContainText('autant de références que tu veux');
  if(info.project.name==='mobile')await screenshot(page,'references-390x844.png');
  await page.locator('[data-refs-new]').tap();
  await expect(page.locator('[data-ref-name]')).toHaveValue('');
  await expect(page.locator('[data-ref-description]')).toHaveValue('');
  await expect(page.locator('[data-ref-editor] img')).toHaveCount(0);
  await expect(page.locator('[data-ref-save]')).toBeDisabled();
  if(info.project.name==='mobile')await screenshot(page,'creation-reference-390x844.png');
  for(const size of [{width:390,height:844},{width:844,height:390},{width:1024,height:600},{width:1280,height:800}]){
    await page.setViewportSize(size);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    expect(await page.locator('[data-refs-sheet]').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(0);
    const small=await page.locator('[data-ref-editor]').evaluate(el=>[...el.querySelectorAll<HTMLElement>('button,input:not([hidden]),select,textarea')].filter(e=>e.getClientRects().length).filter(e=>e.getBoundingClientRect().width<44||e.getBoundingClientRect().height<44).map(e=>e.outerHTML));expect(small).toEqual([]);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-ref-editor]').getByRole('button',{name:'Annuler',exact:true}).tap();
  const categories=['cast','decor','objet','style'];
  for(let i=1;i<=12;i++)await createRef(page,`Référence ${String(i).padStart(2,'0')}`,1,categories[(i-1)%4]);
  await expect(page.locator('[data-ref]')).toHaveCount(12);
  await page.locator('[data-ref-search]').fill('12');await expect(page.locator('[data-ref]')).toHaveCount(1);
  await page.locator('[data-ref-search]').fill('introuvable');await expect(page.locator('[data-ref]')).toHaveCount(0);await expect(page.locator('[data-refs-empty]')).toContainText('recherche');
  // Creating a new card is independent of both the current filter and its name.
  await createRef(page,'Référence 01');await expect(page.locator('[data-ref]')).toHaveCount(13);
  await page.locator('[data-refs-filter=style]').tap();await expect(page.locator('[data-ref]')).toHaveCount(3);
  await page.reload();await openLibrary(page);await expect(page.locator('[data-ref]')).toHaveCount(13);
  for(let i=0;i<7;i++){
    await page.locator('[data-ref]:enabled').first().tap();await expect(page.locator('[data-barre-chip]')).toHaveCount(i+1);
    await openLibrary(page);
  }
  await expect(page.locator('[data-refs-selection-limit]')).toContainText('7 références à cette création');
  await expect(page.locator('[data-ref]:enabled')).toHaveCount(0);
  await expect(page.locator('[data-refs-new]')).toBeEnabled();
  await createRef(page,'Après la sélection',1,'objet');await expect(page.locator('[data-ref]')).toHaveCount(14);
  await page.getByRole('dialog').getByRole('button',{name:'Fermer',exact:true}).tap();
  await page.locator('[data-barre-chip]').first().getByRole('button').tap();await openLibrary(page);
  await page.locator('[data-ref]').filter({hasText:'Après la sélection'}).tap();
  await expect(page.locator('[data-barre-chip]')).toHaveCount(7);
  await expect(page.locator('[data-barre-chips]')).toContainText('Après la sélection');
  await page.reload();await expect(page.locator('[data-barre-chip]')).toHaveCount(7);await openLibrary(page);
  await expect(page.locator('[data-ref]')).toHaveCount(14);expect(paid).toEqual([]);
});

test('Android : références personnelles, réemploi en un clic, devis, résultat puis prompt seul',async({page})=>{
  const comfy=await simulateComfy(page);comfy.setStill(photo.buffer);
  const graphs:Record<string,{class_type:string;inputs:Record<string,unknown>}>[]=[];let uploads=0,cancels=0;
  await page.route(/\/api\/prompt$/,route=>{graphs.push(route.request().postDataJSON().prompt);return route.fallback();});
  await page.route(/\/api\/upload\/image$/,route=>{uploads++;return route.fallback();});
  await page.route(/\/api\/(queue|interrupt)$/,route=>{cancels++;return route.fulfill({json:{}});});
  await page.goto('/studio');await openLibrary(page);await createRef(page,'Référence A',3);await createRef(page,'Référence B');
  await expect(page.locator('[data-ref-kind=cast]')).toHaveCount(2);
  await page.locator('[data-ref]').filter({hasText:'Référence A'}).tap();
  await expect(page.locator('[data-refs-sheet]')).toHaveCount(0);await expect(page.locator('[data-barre-chip]')).toHaveCount(1);
  await page.locator('.u-barre-chip-add').tap();await page.locator('[data-ref]').filter({hasText:'Référence B'}).tap();
  await page.locator('[data-barre-input]').fill('Référence A et Référence B sur un quai, sous la pluie');await page.reload();
  await expect(page.locator('[data-barre-chip]')).toHaveCount(2);await expect(page.locator('[data-barre-input]')).toHaveValue('Référence A et Référence B sur un quai, sous la pluie');
  for(const size of [{width:390,height:844},{width:844,height:390},{width:1024,height:600},{width:1280,height:800}]){
    await page.setViewportSize(size);await page.locator('[data-barre]').scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const small=await page.locator('[data-barre]').evaluate(el=>[...el.querySelectorAll<HTMLElement>('button, textarea')].filter(e=>e.getClientRects().length).filter(e=>e.getBoundingClientRect().width<44||e.getBoundingClientRect().height<44).map(e=>e.outerHTML));expect(small).toEqual([]);
  }
  await page.setViewportSize({width:390,height:844});expect(uploads).toBe(0);expect(graphs).toHaveLength(0);
  await page.locator('[data-barre-send]').tap();await expect(page.locator('[data-fil-confirm]')).toBeVisible();expect(graphs).toHaveLength(0);
  await expect(page.locator('[data-fil-confirm]')).toContainText('crédits estimés');
  await expect(page.locator('[data-barre-home] > [data-tool-shell]')).toHaveCount(0);
  const confirmBox=await page.locator('[data-fil-confirm]').boundingBox();
  expect(confirmBox!.y).toBeGreaterThanOrEqual(0);expect(confirmBox!.y+confirmBox!.height).toBeLessThanOrEqual(844);
  expect(await page.locator('[data-fil-confirm]').evaluate(el=>{const b=el.getBoundingClientRect(),top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return top===el||el.contains(top);})).toBe(true);
  await page.locator('[data-fil-confirm]').tap();await expect(page.locator('[data-bubble-render]')).toBeVisible();await expect(page.locator('[data-bubble-render]')).not.toContainText('Annuler');
  for(const size of [{width:844,height:390},{width:1024,height:600},{width:1280,height:800},{width:390,height:844}]){
    await page.setViewportSize(size);
    const back=await page.locator('[data-bubble-return]').boundingBox();expect(back!.y).toBeGreaterThanOrEqual(0);expect(back!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('[data-bubble-render]').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(0);
  }
  await page.locator('[data-bubble-return]').tap();await expect(page.locator('[data-bubble-render]')).toHaveCount(0);
  await expect(page.locator('[data-fil-job=done]')).toHaveCount(1,{timeout:60000});expect(graphs).toHaveLength(1);expect(uploads).toBe(2);
  expect(graphs[0].image_17.class_type).toBe('ReferenceMultiLatent');expect(graphs[0].reference_2.class_type).toBe('LoadImage');
  expect(graphs[0].image_61.inputs.value).toContain('"Référence A"');expect(graphs[0].image_61.inputs.value).toContain('"Référence B"');
  await page.locator('[data-fil-keep]').tap();await expect(page.locator('[data-fil-keep]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-fil-favorite]').tap();await expect(page.locator('[data-fil-favorite]')).toHaveAttribute('aria-pressed','true');
  await page.reload();await expect(page.locator('[data-fil-job=done]')).toHaveCount(1);expect(graphs).toHaveLength(1);
  await expect(page.locator('[data-fil-favorite]')).toHaveAttribute('aria-pressed','true');
  const download=page.waitForEvent('download');await page.locator('[data-fil-share]').tap();expect((await download).suggestedFilename()).toMatch(/uttu-creation\.webp$/);
  await page.locator('[data-fil-reference]').tap();await expect(page.locator('[data-ref-editor] img')).toHaveCount(1);await page.locator('[data-ref-name]').fill('Image gardée');await page.locator('[data-ref-category]').selectOption('decor');await page.locator('[data-ref-save]').tap();await expect(page.locator('[data-ref-kind=decor]')).toHaveCount(1);await page.getByRole('dialog').getByRole('button',{name:'Fermer',exact:true}).tap();
  await page.locator('[data-barre-input]').fill('Une forêt dorée au lever du jour');await page.locator('[data-barre-send]').tap();
  await page.locator('[data-fil-job=confirm] [data-fil-confirm]').tap();await page.locator('[data-bubble-return]').tap();
  await expect(page.locator('[data-fil-job=done]')).toHaveCount(2,{timeout:60000});expect(graphs).toHaveLength(2);expect(uploads).toBe(2);
  expect(Object.values(graphs[1]).filter(n=>n.class_type==='LoadImage')).toHaveLength(0);expect(cancels).toBe(0);
  await page.goto('/studio#personnage');await expect(page.locator('main')).toContainText('Référence A');await expect(page.locator('main')).toContainText('Référence B');
});

test('rechargement pendant le premier rendu : reprise du reçu, un seul POST, ancien résultat conservé en refaisant',async({page})=>{
  const comfy=await simulateComfy(page);let complete=false,cancels=0;
  await page.route(/\/api\/job\/([^/]+)\/status$/,r=>r.fulfill({json:{status:complete?'success':'in_progress'}}));
  await page.route(/\/api\/(queue|interrupt)$/,r=>{cancels++;return r.fulfill({json:{}});});
  await page.goto('/studio');await page.locator('[data-barre-input]').fill('Un quai au lever du jour, lumière douce');await page.locator('[data-barre-send]').tap();await page.locator('[data-fil-confirm]').tap();
  await expect.poll(()=>page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('u-ttu-barre-fil:')&&!key.endsWith(':nouveau')).some(([,raw])=>JSON.parse(raw).messages.some((m:{jobId?:string})=>Boolean(m.jobId))))).toBe(true);
  expect(comfy.prompts).toHaveLength(1);await page.reload();complete=true;
  await expect(page.locator('[data-fil-job=done]')).toHaveCount(1,{timeout:30000});expect(comfy.prompts).toHaveLength(1);expect(cancels).toBe(0);
  await page.locator('[data-fil-redo]').tap();await expect(page.locator('[data-fil-job=done]')).toHaveCount(1);await expect(page.locator('[data-fil-job=confirm]')).toHaveCount(1);expect(comfy.prompts).toHaveLength(1);
  await page.locator('[data-fil-job=confirm] [data-fil-cancel]').tap();expect(cancels).toBe(0);
});

test('référence : modification, suppression confirmée et persistance des catégories',async({page})=>{
  await page.goto('/studio');await openLibrary(page);await createRef(page,'Texture de cuivre',1,'style');
  await page.locator('[data-ref-edit]').tap();await page.locator('[data-ref-name]').fill('Cuivre patiné');await page.locator('[data-ref-save]').tap();
  await expect(page.locator('[data-ref]')).toContainText('Cuivre patiné');
  await page.locator('[data-ref-delete]').tap();await expect(page.getByRole('alertdialog')).toBeVisible();await page.getByRole('alertdialog').getByRole('button',{name:'Annuler'}).tap();await expect(page.locator('[data-ref]')).toHaveCount(1);
  await page.locator('[data-ref-delete]').tap();await page.locator('[data-ref-delete-confirm]').tap();await expect(page.locator('[data-ref]')).toHaveCount(0);
  await page.reload();await openLibrary(page);await expect(page.locator('[data-ref]')).toHaveCount(0);
});

test('supprimer une fiche de référence conserve les sources d’un rendu pour Refaire',async({page})=>{
  const comfy=await simulateComfy(page);await page.goto('/studio');await openLibrary(page);await createRef(page,'Uttu');await page.locator('[data-ref]').tap();
  await page.locator('[data-barre-input]').fill('Uttu au bord du lac, lumière du matin');await page.locator('[data-barre-send]').tap();await page.locator('[data-fil-confirm]').tap();await page.locator('[data-bubble-return]').tap();await expect(page.locator('[data-fil-job=done]')).toHaveCount(1,{timeout:60000});
  await openLibrary(page);await page.locator('[data-ref-delete]').tap();await page.locator('[data-ref-delete-confirm]').tap();await expect(page.locator('[data-ref]')).toHaveCount(0);await page.getByRole('dialog').getByRole('button',{name:'Fermer',exact:true}).tap();await page.reload();
  await page.locator('[data-fil-redo]').tap();expect(comfy.prompts).toHaveLength(1);await page.locator('[data-fil-job=confirm] [data-fil-confirm]').tap();await page.locator('[data-bubble-return]').tap();await expect(page.locator('[data-fil-job=done]')).toHaveCount(2,{timeout:60000});expect(comfy.prompts).toHaveLength(2);
});

test('vidéo : références existantes, audio, 10 s, format carré, 720p, son coupé et montage',async({page})=>{
  const comfy=await simulateComfy(page);let graph:Record<string,{class_type:string;inputs:Record<string,unknown>}>={};
  comfy.setVideo(readFileSync('e2e/fixtures/prise-10s-vp9.mp4'));
  await page.route(/\/api\/prompt$/,r=>{graph=r.request().postDataJSON().prompt;return r.fallback();});
  await page.goto('/studio#personnage');await page.getByLabel('Importer un personnage',{exact:true}).setInputFiles({...photo,name:'Uttu.webp'});
  await expect(page.locator('.u-toast')).toHaveText('Ajouté : 1');
  await page.goto('/studio');await openLibrary(page);await expect(page.locator('[data-ref-kind=cast]')).toHaveCount(1);await page.locator('[data-ref]').tap();
  await page.locator('[data-barre-mode=video]').tap();await page.locator('[data-barre-settings]').tap();
  await page.locator('[data-barre-duree="10"]').tap();await page.locator('[data-barre-resolution="720p"]').tap();await page.locator('[data-barre-format="1:1"]').tap();await page.locator('[data-barre-sound]').tap();
  await page.locator('[data-barre-settings]').tap();
  const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(16036,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
  await page.locator('[data-barre-audio]').setInputFiles({name:'ambiance.wav',mimeType:'audio/wav',buffer:wav});
  await expect(page.locator('[data-bubble-audio]')).toContainText('ambiance.wav');
  await page.locator('[data-barre-input]').fill('Uttu marche sur un quai, le vent soulève son manteau');await page.locator('[data-barre-send]').tap();expect(comfy.prompts).toHaveLength(0);
  await page.locator('[data-fil-confirm]').tap();await page.locator('[data-bubble-return]').tap();await expect(page.locator('[data-fil-job=done]')).toHaveCount(1,{timeout:60000});
  expect(graph['136'].class_type).toBe('MiniMaxH3ReferenceToVideo');expect(graph['136'].inputs['ref_audios.ref_audio_0']).toEqual(['reference_audio',0]);expect(graph['132'].inputs.value).toBe(10);expect(graph['130'].inputs.audio).toBeUndefined();expect(graph['115'].inputs.aspect_ratio).toContain('1:1');
  await page.locator('[data-fil-result] > .u-fil-actions [data-montage-add]').tap();await expect(page.locator('[data-fil-result] [data-montage-done]')).toBeVisible();
  await page.goto('/studio#montage');await expect(page.locator('.u-clip.is-video')).toHaveCount(1);await expect(page.locator('.u-clip.is-video')).toHaveAttribute('data-clip-seconds','10');
});
