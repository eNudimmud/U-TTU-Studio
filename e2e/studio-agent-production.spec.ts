import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { simulateComfy } from './helpers/simulate-comfy';
import { openAssistant, showPlan } from './helpers/top-bar';
const image=readFileSync('public/exemples/cast-dj.webp');
async function assistant(page:Page){const panel=page.locator('[data-assistant-panel]');if(!await panel.isVisible())await openAssistant(page);await showPlan(page);return panel;}
async function approve(page:Page,operation:string){const panel=await assistant(page);const step=panel.locator(`[data-agent-step="${operation}"]`);await expect(step.locator('[data-agent-accept]')).toBeEnabled();await step.locator('[data-agent-accept]').click();await expect(step).toHaveAttribute('data-state','done');}
async function prepare(page:Page,operation:string){const panel=await assistant(page);const step=panel.locator(`[data-agent-step="${operation}"]`);await expect(step.locator('[data-agent-prepare]')).toBeEnabled();await step.locator('[data-agent-prepare]').click();}
test('agent: project → CAST → DÉCOR → plans → PRISE in the film → reopen (cloud mocked)',async({page},info)=>{
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
 await expect(page).toHaveURL(/#prise/);await expect(page.locator('[data-film-plans]')).toBeVisible();
 // The take is shot in the film's plans, with its own quote and confirmation (film2-* specs).
 await prepare(page,'local:take');
 await expect(page).toHaveURL(/#prise/);await expect(page.locator('[data-film-plans]')).toBeVisible();
 await page.reload();panel=await assistant(page);await expect(panel.locator('[data-agent-step][data-state=done]')).toHaveCount(3);
 await expect(panel.locator('[data-assistant-input]')).toBeVisible();
 expect(cloud.prompts).toHaveLength(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('agent-complete.png'),fullPage:true});
});
