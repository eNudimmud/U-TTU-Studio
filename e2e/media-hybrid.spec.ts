import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openAssistant } from './helpers/top-bar';
const image=readFileSync('public/exemples/cast-dj.webp');
const id='12345678-1234-4234-8234-123456789abc';
test('hybrid library: metadata only, dedup, classification, lazy download, reopen and missing remote (mocked)',async({page},info)=>{
 let downloads=0,posts=0,missing=false;
 await page.addInitScript(()=>localStorage.setItem('u-ttu-rendu',JSON.stringify({mode:'key',key:'mock-library-key-12345'})));
 await page.route(/overpass|nominatim|photon|panoramax|mapillary|typesafe\.ai/,r=>r.abort());
 await page.route(/\/api\/user$/,r=>r.fulfill({json:{id:'library-test'}}));
 await page.route(/\/api\/billing\//,r=>r.fulfill({json:{summary:{balance:{amount_micros:1000000}}}}));
 await page.route(/\/api\/prompt|\/api\/upload|\/api\/queue/,r=>{posts++;return r.abort();});
 const row={id,name:'E*NKI laboratoire.webp',mime_type:'image/webp',size:image.length,created_at:'2026-10-21T00:00:00Z',preview_url:'https://expired.invalid/temporary'};
 await page.route(/\/api\/assets\?/,r=>r.fulfill({json:{assets:[row],has_more:false,total:1}}));
 await page.route(new RegExp(`/api/assets/${id}$`),r=>r.fulfill(missing?{status:404,json:{}}:{json:row}));
 await page.route(new RegExp(`/api/v2/assets/${id}$`),r=>r.fulfill({json:{...row,content_type:'image/webp',size_bytes:image.length,url:'https://expired.invalid/old',url_expires_at:'2020-01-01T00:00:00Z'}}));
 await page.route(new RegExp(`/api/v2/assets/${id}/content$`),r=>{downloads++;return r.fulfill({contentType:'image/webp',body:image});});
 await page.goto('/studio#personnage');
 await page.getByLabel('Importer un personnage',{exact:true}).setInputFiles({name:'Local.webp',mimeType:'image/webp',buffer:image});
 await page.goto('/mon-studio');
 const library=page.locator('#mediatheque');await library.locator('[data-media-sync]').click();
 const remote=library.locator('[data-media-id^="cloud:"]');await expect(remote).toHaveCount(1);expect(downloads).toBe(0);
 await library.locator('[data-media-sync]').click();await expect(remote).toHaveCount(1);
 await remote.getByRole('checkbox').check();await library.getByText(/Classer la sélection/).click();await library.getByLabel('Séquence',{exact:true}).fill('F');await library.getByRole('button',{name:'Confirmer le classement'}).click();
 await expect(remote).toContainText('F');
 await remote.getByRole('button',{name:'Télécharger et utiliser'}).click();await expect(page.locator('[data-assistant-panel]')).toBeVisible();expect(downloads).toBe(1);expect(posts).toBe(0);
 const panel=page.locator('[data-assistant-panel]');await expect(panel.getByText(/Références sélectionnées \(1\)/)).toBeVisible();
 await panel.getByRole('button',{name:/Fermer/}).click();
 await page.reload();await expect(library.locator('[data-media-id^="cloud:"]')).toHaveCount(1);await expect(remote).toContainText('Sur cet appareil');await expect(remote).toContainText('F');
 missing=true;await remote.getByRole('checkbox').check();await library.getByRole('button',{name:'Vérifier la sélection'}).click();await expect(remote).toContainText('Indisponible sur Comfy');await expect(remote).toContainText('Sur cet appareil');
 expect(downloads).toBe(1);expect(posts).toBe(0);
 await library.getByText('Sauvegarde et transfert',{exact:true}).click();const transfer=page.waitForEvent('download');await library.getByRole('button',{name:'Exporter le manifeste'}).click();const file=await transfer;await file.saveAs(info.outputPath('manifest.json'));
 const text=readFileSync(info.outputPath('manifest.json'),'utf8');expect(text).not.toMatch(/mock-library-key|expired\.invalid/);
 await page.screenshot({path:info.outputPath('hybrid-library.png'),fullPage:true});
 // A missing remote remains reusable through its explicitly downloaded cache.
 await openAssistant(page);
 await panel.locator('[data-assistant-input]').fill('Assemble cette image au montage');
 await panel.locator('[data-agent-send]').click();
 await panel.locator('[data-agent-step="local:montage"] [data-agent-prepare]').click();
 await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
 await openAssistant(page);
 const montage=panel.locator('[data-agent-step="local:montage"]');
 await expect(montage.locator('[data-agent-accept]')).toBeEnabled();
 await montage.locator('[data-agent-accept]').click();
 await expect(montage).toHaveAttribute('data-state','done');
 await page.reload();await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
 expect(downloads).toBe(1);expect(posts).toBe(0);
});

test('hybrid library: selected cloud video and audio persist on the native timeline (mocked)',async({page})=>{
 const video=readFileSync('e2e/fixtures/final-1080p.mp4');
 const sound=readFileSync('public/exemples/voix-exemple.wav');
 const audioId='12345678-1234-4234-8234-123456789abd';
 const rows=[{id,name:'Plan laboratoire.mp4',mime_type:'video/mp4',size:video.length},{id:audioId,name:'Ambiance.wav',mime_type:'audio/wav',size:sound.length}];
 let downloads=0,posts=0;
 await page.addInitScript(()=>localStorage.setItem('u-ttu-rendu',JSON.stringify({mode:'key',key:'mock-library-key-12345'})));
 await page.route(/overpass|nominatim|photon|panoramax|mapillary|typesafe\.ai/,r=>r.abort());
 await page.route(/\/api\/user$/,r=>r.fulfill({json:{id:'library-test'}}));
 await page.route(/\/api\/billing\//,r=>r.fulfill({json:{summary:{balance:{amount_micros:1000000}}}}));
 await page.route(/\/api\/prompt|\/api\/upload|\/api\/queue/,r=>{posts++;return r.abort();});
 await page.route(/\/api\/assets\?/,r=>r.fulfill({json:{assets:rows,has_more:false,total:2}}));
 for(const row of rows){
  await page.route(new RegExp(`/api/v2/assets/${row.id}/content$`),r=>{downloads++;return r.fulfill({contentType:row.mime_type,body:row.id===id?video:sound});});
 }
 await page.goto('/studio#personnage');
 await page.getByLabel('Importer un personnage',{exact:true}).setInputFiles({name:'Local.webp',mimeType:'image/webp',buffer:image});
 await page.goto('/mon-studio');
 const library=page.locator('#mediatheque');await library.locator('[data-media-sync]').click();
 await expect(library.locator('[data-media-id^="cloud:"]')).toHaveCount(2);expect(downloads).toBe(0);
 const panel=page.locator('[data-assistant-panel]');
 for(const [index,row] of rows.entries()){
  await library.locator(`[data-media-id$="${row.id}"]`).getByRole('button',{name:'Télécharger et utiliser'}).click();
  await expect(panel.getByText(`Références sélectionnées (${index+1})`)).toBeVisible();
  await panel.getByRole('button',{name:/Fermer/}).click();
 }
 await openAssistant(page);
 await panel.locator('[data-assistant-input]').fill('Assemble ces médias au montage');
 await panel.locator('[data-agent-send]').click();
 await panel.locator('[data-agent-step="local:montage"] [data-agent-prepare]').click();
 await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
 await expect(page.locator('.u-clip.is-audio')).toHaveCount(1);
 await openAssistant(page);
 const step=panel.locator('[data-agent-step="local:montage"]');
 await expect(step.locator('[data-agent-accept]')).toBeEnabled();
 await step.locator('[data-agent-accept]').click();await expect(step).toHaveAttribute('data-state','done');
 await page.reload();await expect(page.locator('.u-clip.is-video')).toHaveCount(1);await expect(page.locator('.u-clip.is-audio')).toHaveCount(1);
 expect(downloads).toBe(2);expect(posts).toBe(0);
});
