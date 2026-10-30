import { expect, test, type Page, type CDPSession } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/simulate-comfy';

test.use({ hasTouch:true, launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']} });
const SIZES=[[390,844],[844,390],[1024,600],[1280,800]] as const;

async function prepare(page:Page) {
 await simulateComfy(page);
 await page.route(/\/api\/billing\/usage\/timeseries|customers\/balance/,r=>r.fulfill({json:{summary:{balance:{amount_micros:500_000_000}}}}));
 await page.goto('/studio#personnage');
 await page.getByLabel('Importer un personnage',{exact:true}).setInputFiles({name:'Léa.webp',mimeType:'image/webp',buffer:readFileSync('public/exemples/cast-coursiere.webp')});
 const nav=page.getByRole('navigation');
 await expect(nav.getByRole('button',{name:'CAST'})).toContainText('Prêt');
 await nav.getByRole('button',{name:'DÉCOR'}).tap();
 await page.getByLabel('Importer un décor',{exact:true}).setInputFiles({name:'Le laboratoire.webp',mimeType:'image/webp',buffer:readFileSync('public/exemples/decor-couloir.webp')});
 await expect(nav.getByRole('button',{name:'DÉCOR'})).toContainText('Prêt');
 await nav.getByRole('button',{name:'PRISE'}).tap();
 await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
 await page.getByRole('textbox',{name:'Ce qui se passe',exact:true}).fill('Léa ouvre la porte');
 await unfold(page);
 await expect(page.locator('[data-maquette]')).toHaveAttribute('data-figures','1');
 await expect(page.locator('[data-framing-save]')).toBeEnabled();
}
async function unfold(page:Page) {
 const advanced=page.locator('[data-avance-prise]');
 if(await advanced.getAttribute('open')===null) await advanced.locator(':scope > summary').tap();
 const toggle=page.locator('[data-avance-toggle="maquette"]');
 if(await toggle.getAttribute('aria-expanded')==='false') await toggle.tap();
}
async function keep(page:Page,mouse=false) {
 if(mouse) await page.locator('[data-framing-save]').click();else await page.locator('[data-framing-save]').tap();
 await expect(page.locator('[data-framing-kept]')).toBeVisible();
 await expect(page.locator('[data-framing-save]')).toBeEnabled();
 await expect(page.locator('[data-plan-save]')).toHaveAttribute('data-plan-save','saved');
 const images=page.locator('[data-framing-kept] img');
 await expect.poll(()=>images.evaluateAll(imgs=>imgs.every(i=>(i as HTMLImageElement).naturalWidth===1280))).toBe(true);
 return images;
}
async function imageData(page:Page,kind:string) {
 return page.locator(`[data-framing-kept] img[alt="${kind}"]`).evaluate(async (node:HTMLImageElement)=>{
  const canvas=document.createElement('canvas');canvas.width=node.naturalWidth;canvas.height=node.naturalHeight;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(node,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let min=255,max=0,nonzero=0;for(let i=0;i<pixels.length;i+=4){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);if(pixels[i]>0)nonzero++;}
  const bytes=new Uint8Array(await (await fetch(node.src)).arrayBuffer());
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return {width:canvas.width,height:canvas.height,min,max,nonzero,hash:Array.from(new Uint8Array(hash)).join('-'),png:canvas.toDataURL('image/png').split(',')[1]};
 });
}
function proof(name:string,png:string) {
 if(!process.env.PRISE_SHOTS_DIR)return;
 mkdirSync(process.env.PRISE_SHOTS_DIR,{recursive:true});writeFileSync(join(process.env.PRISE_SHOTS_DIR,`${name}.png`),Buffer.from(png,'base64'));
}

test('cadrage 3D : deux exports distincts, persistance et contrôles effectivement envoyés avant LTX',async({page})=>{
 test.setTimeout(180_000);
 const graphs:Record<string,{class_type:string;inputs:Record<string,unknown>}>[]=[];
 page.on('request',r=>{if(/\/api\/prompt$/.test(r.url()))graphs.push(r.postDataJSON().prompt);});
 await prepare(page);
 await expect(page.locator('[data-maquette]')).toHaveAttribute('data-maquette','webgl');
 await keep(page);
 const a=await imageData(page,'Profondeur');
 expect(a.width).toBe(1280);expect(a.height).toBe(720);expect(a.max-a.min).toBeGreaterThan(20);
 const edges=await imageData(page,'Contours');expect(edges.nonzero).toBeGreaterThan(100);
 const colorA=await imageData(page,'Aperçu');
 proof('cadrage-a-depth',a.png);proof('cadrage-a-apercu',colorA.png);
 await page.locator('[data-tuile="large"]').tap();
 await keep(page);
 const b=await imageData(page,'Profondeur');expect(b.hash).not.toBe(a.hash);
 proof('cadrage-b-depth',b.png);proof('cadrage-b-apercu',(await imageData(page,'Aperçu')).png);
 const original=page.viewportSize()!;
 for(const [width,height]of SIZES){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);for(const button of await page.locator('[data-framing-panel] button').all())if(await button.isVisible()){const box=(await button.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);}}
 await page.setViewportSize(original);
 if(process.env.PRISE_SHOTS_DIR&&original.width===390){await page.locator('[data-framing-panel]').scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.PRISE_SHOTS_DIR,'cadrage-mobile-390x844.png')});}
 await page.reload();await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();await unfold(page);
 await expect(page.locator('[data-framing-kept]')).toHaveAttribute('data-framing-kept','3d');
 await expect.poll(async()=>(await imageData(page,'Profondeur')).hash).toBe(b.hash);
 await page.locator('.u-prise-actions .u-primary').tap();
 await expect(page.locator('#u-confirm-cost')).toContainText('26');
 expect(graphs).toHaveLength(0);
 await page.locator('[data-confirm-gold]').tap();
 await expect.poll(()=>graphs.length).toBe(1);
 const graph=graphs[0];
 expect(graph['control_111:85'].class_type).toBe('ControlNetApplyAdvanced');
 expect(graph['control_111:85'].inputs.image).toEqual(['control_depth',0]);
 expect(graph['control_edges_apply'].inputs.image).toEqual(['control_edges',0]);
 expect(graph['398:351'].inputs.input).toEqual(['control_111:8',0]);
 await expect(page.locator('[data-take-view] video')).toBeVisible({timeout:60000});
});

test('cadrage 2D : silhouettes et fond au doigt, zoom, PNG gardés puis retrait sans dépense',async({page})=>{
 await prepare(page);
 const phone=page.viewportSize()!.width<700;
 if(phone)await page.locator('[data-framing-2d]').tap();else await page.locator('[data-framing-2d]').click();
 const canvas=page.locator('[data-framing-flat]');await expect(canvas).toBeVisible();
 const stage=page.locator('[data-maquette]');const before=await stage.getAttribute('data-layout');
 await canvas.scrollIntoViewIfNeeded();
 const box=(await canvas.boundingBox())!;
 let touch:CDPSession|undefined;
 if(phone){
  await canvas.evaluate(node=>node.addEventListener('pointerdown',event=>{node.dataset.testPointer=String((event as PointerEvent).pointerId);},{once:true}));
  touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.5,y:box.y+box.height*.6}]});
  for(let step=1;step<=5;step++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*(.5+.18*step/5),y:box.y+box.height*.6}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>canvas.evaluate(node=>node.dataset.testPointer!==undefined&&!node.hasPointerCapture(Number(node.dataset.testPointer)))).toBe(true);
 }else{
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.68,box.y+box.height*.6,{steps:5});await page.mouse.up();
 }
 await expect(stage).not.toHaveAttribute('data-layout',before!);
 await page.locator('[data-framing-panel] input[type=range]').fill('140');
 await expect(stage).toHaveAttribute('data-flat-zoom','1.4');
 await keep(page,!phone);await expect(page.locator('[data-framing-kept]')).toHaveAttribute('data-framing-kept','2d');
 await expect(page.getByText('En 2D, la profondeur est un guide de silhouettes', {exact:false})).toBeVisible();
 await expect(page.locator('[data-framing-mode="plat"] .u-maquette-distance')).toBeHidden();
 if(phone)await page.locator('[data-framing-clear]').tap();else await page.locator('[data-framing-clear]').click();
 await expect(page.locator('[data-framing-kept]')).toHaveCount(0);
 await touch?.detach();
});

test('sans WebGL : seul le cadrage 2D utilisable reste proposé et exportable',async({page})=>{
 await page.addInitScript(()=>{
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){if(type.startsWith('webgl')||type==='experimental-webgl')return null;return (get as Function).call(this,type,...args); } as typeof get;
 });
 await prepare(page);await expect(page.locator('[data-maquette]')).toHaveAttribute('data-maquette','plat');
 await expect(page.getByRole('button',{name:'Vue 3D',exact:true})).toHaveCount(0);
 await page.locator('[data-framing-2d]').tap();
 await keep(page);await expect(page.locator('[data-framing-kept]')).toHaveAttribute('data-framing-kept','2d');
});
