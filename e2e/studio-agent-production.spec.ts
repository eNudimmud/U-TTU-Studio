import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { simulateComfy } from './helpers/simulate-comfy';
import { openAssistant, showPlan } from './helpers/top-bar';
const image=readFileSync('public/exemples/cast-dj.webp');
async function assistant(page:Page){const panel=page.locator('[data-assistant-panel]');if(!await panel.isVisible())await openAssistant(page);await showPlan(page);return panel;}
async function approve(page:Page,operation:string){const panel=await assistant(page);const step=panel.locator(`[data-agent-step="${operation}"]`);await expect(step.locator('[data-agent-accept]')).toBeEnabled();await step.locator('[data-agent-accept]').click();await expect(step).toHaveAttribute('data-state','done');}
async function prepare(page:Page,operation:string){const panel=await assistant(page);const step=panel.locator(`[data-agent-step="${operation}"]`);await expect(step.locator('[data-agent-prepare]')).toBeEnabled();await step.locator('[data-agent-prepare]').click();}
test('agent: project → CAST → DÉCOR → PRISE → MONTAGE → export → backup → reopen (cloud mocked)',async({page},info)=>{
 test.setTimeout(240000);
 const cloud=await simulateComfy(page);
 await page.route(/typesafe\.ai|\/studio-agent\/interpret/,r=>r.abort());
 await page.goto('/studio#personnage');
 let panel=await assistant(page);
 const projectName=panel.getByLabel('Nom du projet',{exact:true});
 if(await projectName.isVisible()){await projectName.fill('Agent QA');await panel.getByRole('button',{name:'Créer le projet',exact:true}).click();}
 await panel.locator('[data-assistant-input]').fill('Prépare un court-métrage complet : Alice traverse le laboratoire.');
 await panel.locator('[data-agent-send]').click();
 await expect(panel.locator('[data-agent-step]')).toHaveCount(8);
 expect(cloud.prompts).toHaveLength(0);
 await prepare(page,'local:cast');
 await page.getByLabel('Importer un personnage',{exact:true}).setInputFiles({name:'Alice.webp',mimeType:'image/webp',buffer:image});
 await approve(page,'local:cast');
 await prepare(page,'local:decor');
 await page.getByLabel('Importer un décor',{exact:true}).setInputFiles({name:'Laboratoire.webp',mimeType:'image/webp',buffer:image});
 await approve(page,'local:decor');
 panel=await assistant(page);await panel.getByText(/Références sélectionnées/,{exact:false}).click();
 await panel.getByRole('checkbox',{name:/Alice/}).check();
 await panel.getByRole('checkbox',{name:/Laboratoire/}).check();
 await prepare(page,'local:shots');
 await expect(page.locator('[data-maquette]')).toHaveAttribute('data-figures','1');
 await prepare(page,'local:take');
 await page.getByRole('textbox',{name:'Ce qui se passe',exact:true}).fill('Alice traverse le laboratoire');
 await expect(page.locator('[data-tourner-gold]')).toBeEnabled();
 await page.locator('[data-tourner-gold]').click();
 await expect(page.locator('[data-confirm-gold]')).toBeEnabled();expect(cloud.prompts).toHaveLength(0);
 await page.locator('[data-confirm-gold]').click();
 await expect.poll(()=>cloud.prompts.length).toBe(1);
 await expect(page.locator('.u-prise video[controls]')).toBeVisible({timeout:60000});
 await approve(page,'local:take');
 panel=await assistant(page);const references=panel.locator('.u-agent-resources');if(!await references.isVisible())await panel.getByText(/Références sélectionnées/).click();
 await panel.getByRole('checkbox',{name:/Alice traverse le laboratoire/}).check();
 await prepare(page,'local:montage');await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
 await prepare(page,'local:export');
 const exported=page.waitForEvent('download');await page.locator('[data-export-open]').click();const film=await exported;await film.saveAs(info.outputPath('agent-film.mp4'));
 await expect(page.locator('[data-export]')).toHaveAttribute('data-export','done');
 await page.getByRole('dialog',{name:'Exporter',exact:true}).getByRole('button',{name:'Annuler',exact:true}).click();
 await approve(page,'local:export');
 const archived=page.waitForEvent('download');await prepare(page,'local:backup');const zip=await archived;await zip.saveAs(info.outputPath('agent-backup.zip'));
 await expect(page.locator('[data-agent-step="local:backup"]')).toHaveAttribute('data-state','done');
 await prepare(page,'local:projects');await expect(page).toHaveURL(/mon-studio/);await approve(page,'local:projects');
 await page.reload();panel=await assistant(page);await expect(panel.locator('[data-agent-step][data-state=done]')).toHaveCount(8);
 await expect(panel.locator('[data-assistant-input]')).toBeVisible();
 expect(cloud.prompts).toHaveLength(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('agent-complete.png'),fullPage:true});
});
