"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { STYLE_RECIPES, PROMPT_USES, buildStylePrompt, searchStyles, type StyleRecipe, type PromptUse } from "@/lib/sections/styles";
import type { Section } from "@/lib/sections/registry";
function RecipeDialog({title,close,children}:{title:string;close:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current!;d.showModal();return()=>d.close();},[]);
  return <dialog ref={ref} className="ps-recipe" aria-label={title} onCancel={close} onClick={e=>{if(e.target===e.currentTarget)close();}}>{children}</dialog>;
}
export default function PromptLibrary({ section, onUse, onSave }: { section: Section; onUse: (style: StyleRecipe, use: PromptUse, prompt: string) => void; onSave: (text:string) => Promise<void> }) {
  const [query,setQuery]=useState(""),[family,setFamily]=useState("Toutes"),[limit,setLimit]=useState(12);
  const [selected,setSelected]=useState<StyleRecipe|null>(null),[use,setUse]=useState<PromptUse>("shoot");
  const [subject,setSubject]=useState("a courier wearing a patched work jacket, carrying a sealed metal case");
  const [message,setMessage]=useState("");
  useEffect(()=>{setSelected(null);setFamily("Toutes");setQuery("");setLimit(12);},[section]);
  const families=useMemo(()=>["Toutes",...new Set(STYLE_RECIPES.filter(s=>s.section===section).map(s=>s.family))],[section]);
  const results=searchStyles(section,query,family);
  const prompt=selected?buildStylePrompt(selected,use,subject):"";
  return <section className="ps-library" aria-label="Promptothèque artistique">
    <div className="ps-library-search"><label>Rechercher un style, un artiste, une matière<input type="search" placeholder="Gekiga, VHS, Gondry, papier, Arcane…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(12);}}/></label><label>Famille<select value={family} onChange={e=>{setFamily(e.target.value);setLimit(12);}}>{families.map(f=><option key={f}>{f}</option>)}</select></label></div>
    <div className="ps-section-title"><h2>{results.length} directions artistiques</h2><span>Personnage · décor · plan · mouvement</span></div>
    <div className="ps-style-grid">{results.slice(0,limit).map((style,index)=><button key={style.id} className={`ps-style-card ${selected?.id===style.id?"selected":""}`} onClick={()=>{setSelected(style);setMessage("");}} aria-pressed={selected?.id===style.id}><div className="ps-style-index"><span>{style.family}</span><small>{String(index+1).padStart(2,"0")}</small></div><h3>{style.title}</h3><p>{style.references.slice(0,2).join(" · ")}</p><div className="ps-style-bottom"><span>Explorer la recette</span><span>→</span></div></button>)}</div>
    {!results.length&&<p className="ps-note">Aucune fiche pour cette recherche dans {section.toUpperCase()}. Essaie un autre mot ou change d’univers.</p>}
    {results.length>limit&&<button className="ps-more" onClick={()=>setLimit(n=>n+12)}>Afficher les {Math.min(12,results.length-limit)} suivantes</button>}
    {selected&&<RecipeDialog title={selected.title} close={()=>setSelected(null)}><div className="ps-dialog-head"><div><p className="ps-eyebrow">{selected.family.toUpperCase()} · {section.toUpperCase()}</p><h2>{selected.title}</h2></div><button aria-label="Fermer la recette" onClick={()=>setSelected(null)}>×</button></div><p className="ps-recipe-refs">Repères : {selected.references.join(" · ")}</p><div className="ps-recipe-uses">{(Object.keys(PROMPT_USES) as PromptUse[]).map(u=><button key={u} onClick={()=>setUse(u)} aria-pressed={use===u}>{PROMPT_USES[u]}</button>)}</div>{use!=="set"&&use!=="motion"&&<label>Sujet à mettre en scène · en anglais<input value={subject} onChange={e=>setSubject(e.target.value)} /></label>}<label>Prompt prêt à utiliser · anglais<textarea readOnly rows={10} value={prompt}/></label><div className="ps-actions"><button onClick={()=>void navigator.clipboard.writeText(prompt).then(()=>setMessage("Prompt copié.")).catch(()=>setMessage("Sélectionne le texte pour le copier."))}>Copier le prompt</button><button onClick={()=>void onSave(`${selected.title}\n\n${prompt}`).then(()=>setMessage("Direction artistique ajoutée à la bible du projet.")).catch(e=>setMessage(e.message))}>Ajouter à la bible</button><button className="ps-primary" onClick={()=>onUse(selected,use,prompt)}>Utiliser dans {use==="motion"?"Shoot":use==="cast"?"Cast":use==="set"?"Set":"Shoot"} →</button></div>{message&&<p role="status">{message}</p>}</RecipeDialog>}
    <p className="ps-editor-note">Recettes originales inspirées de ces repères artistiques. Adapte le sujet et les références au projet ; chaque modèle interprète le prompt à sa manière.</p>
  </section>;
}
