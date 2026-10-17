# U*TTU Studio

**EN** — U*TTU Studio is a multilingual, Comfy-powered AI film studio where you create your characters (CAST) and sets from real-world locations (DÉCOR), compose your shots (PRISE) and edit them (MONTAGE), with a quote before every spend and a "Finalize" step that enhances your take without ever regenerating it.

**FR** — U*TTU Studio est un studio de cinéma IA multilingue, propulsé par Comfy : tu crées tes personnages (CAST) et tes décors à partir de vrais lieux (DÉCOR), tu composes tes plans (PRISE) et tu les montes (MONTAGE), avec un devis avant chaque dépense et un « Finaliser » qui améliore le rendu sans jamais le régénérer.

Live: <https://u-ttu-studio.vercel.app/studio> · License: [MIT](LICENSE) · Languages: FR (source), EN, DE, ES.

---

## English

### Built on the Comfy Developer Platform

Every render runs on the visitor's own Comfy account through the documented **Comfy Cloud API** (`POST /api/upload/image`, `POST /api/prompt`, `GET /api/job/{id}/status`, `GET /api/jobs/{id}`, `GET /api/view`, balance from `api.comfy.org`), via a same-origin relay that stores nothing ([`src/lib/comfy-proxy.ts`](src/lib/comfy-proxy.ts)). The studio sells nothing and keeps no visitor account; files live in a local vault on the device.

| Tab | Default engine | Template(s) | Weights |
| --- | --- | --- | --- |
| CAST | **FLUX 3 Image Klein** (text, photo edit, outfit) | `image_flux3_klein_t2i`, `image_flux3_klein_image_edit` | open |
| CAST | **FLUX 3 Image** (several references, view sheet) | `api_bfl_flux3_image_edit` | partner |
| DÉCOR | **FLUX 3 Image Klein** (text, real place photo, time of day) | `image_flux3_klein_t2i`, `image_flux3_klein_image_edit` | open |
| PRISE | **LTX-2.5** image-to-video, first frame composed by FLUX 3 Klein from character + set (one graph) | `video_ltx2_5_i2v` (+ Klein edit) | open |
| PRISE | **MiniMax H3** reference-to-video, second engine | `video_minimax_h3_r2v` | open |
| PRISE (video gestures) | **Directed camera** (previs-to-picture: the studio's 3D maquette is filmed in the browser, MoGe depth + LTX-2.3 IC-LoRA union control render the shot), LTX-2.5 first/last frame bridge, LTX-2.3 IC-LoRA camera, LTX-2.3 video outpainting and object removal (VFX / re-shoot) | `video_ltx2_5_flf2v`, `video_ltx2_3_ic_lora`, `template_ltx2_3_lora_video_outpainting`, `template_ltx2_3_obscura_remova_lora_remove_object_from_video` | open |
| MONTAGE | voice, sound effect, music | ElevenLabs, Sonilo partner templates | partner |
| Finalize | NVIDIA RTX Video Super Resolution on the whole edit, optional denoise/deblur (never regenerates) | `utility_nvidia_rtx_video_enhance` (Super Resolution stage) | see NVIDIA license; not verified for Open Weights Only |

Nano Banana stays available as an **option, off by default** (toggle « Nano Banana (option) »). **Open weights only** hides partner gestures and rejects them again before submission. RTX finalization is unavailable in that mode until its model license is verified; local MP4 export remains available. Both toggles sit above the gesture cards; the PRISE tab has an engine switch (LTX-2.5 default / MiniMax H3).

### Workflows

[`workflows/`](workflows) holds one Comfy workflow per gesture:

- `workflows/<tab>/<gesture>.json` — the official Comfy template the gesture comes from (UI format: drag it into ComfyUI);
- `workflows/<tab>/<gesture>.api.json` — the exact API graph the studio sends, for wired gestures (placeholders `uttu-*.jpg` and `<texte du visiteur>`);
- `workflows/index.json` — gesture → template, partner nodes, files. `tests/workflows-export.test.ts` keeps it equal to the registry ([`src/lib/workflows/registre.ts`](src/lib/workflows/registre.ts)).

Regenerate: `node --experimental-strip-types scripts/export-workflows.mjs` (reads templates from `Comfy-Org/workflow_templates`, partner flags from a local ComfyUI `/object_info` when one runs).

### Run locally

Requirements: Node ≥ 22.

```bash
npm ci
npm run dev          # http://localhost:3000/studio
npm test             # unit tests
npm run build
```

Link a Comfy Cloud account in the app (session or API key, kept on the device) to render.

**Fully local, open weights, with your own ComfyUI:**

1. Install/update [ComfyUI](https://github.com/comfyanonymous/ComfyUI) and start it (`python main.py`, default `http://127.0.0.1:8188`).
2. Open any `workflows/<tab>/<gesture>.json` in ComfyUI: the template's notes list the model files and their Hugging Face links (FLUX 3 Image Klein, LTX-2.5, MiniMax H3, SeedVR2).
3. Or run the studio's exact graph: 
   ```bash
   node scripts/run-local.mjs workflows/prise/prise-plan.api.json \
     --text "Uttu walks along the quay at night" \
     --image uttu-personnage.jpg=./uttu.png --image uttu-lieu.jpg=./quay.png
   ```
   The script refuses graphs with partner nodes unless `--allow-partner` is set.

Every feature runs through its dedicated Comfy workflow (official template, exported): see `docs/AUDIT-WORKFLOWS-COMFY.md`.

### Touch previs (phone)
In PRISE, the 3D maquette is driven by touch: one finger orbits or moves a person or a prop, two fingers pinch. A camera path is built from timed keyframes (up to 8 over 5 s, eased). « Sentence → scene » is a small rule-based agent (FR/EN/DE/ES, no language model, no network) that lays out mannequins, props and a camera move. Props are primitives or an imported `.glb`, simplified on the device (20 000 triangles on a phone). « Film the previs » records 5 s of the canvas with MediaRecorder and hands the clip straight to « Directed camera » (LTX-2.3 IC-LoRA). « Generate in 3D » runs the official open-weights templates `3d_hunyuan3d-v2.1` (person) and `3d_pixal3d_trellis2_image_to_model` (prop or set, decimated to 40 000 faces by the template's own node), with an estimated quote and a confirmation before any spend.

### Next step: cloud Blender over MCP (not built)
Version 2 keeps the phone as a light three.js editor and lets an agent drive a headless Blender in the cloud for richer scenes and exact depth/pose passes:
- **Where Blender runs:** a GPU container billed per second (e.g. Modal L4), or a managed Blender MCP service such as Sceneplane (to be tested, pricing not checked).
- **How the agent drives it:** strict JSON tools (`add_actor`, `set_camera_path`, `import_glb`, `render_previs`) translated to `bpy`. The `mcp-for-blender` addon executes arbitrary Python over an unauthenticated socket: it only ever runs behind a private network or an SSH tunnel, never exposed publicly.
- **What comes back:** a GLB the phone reopens, and an Eevee/Workbench previs MP4 (depth or pose) sent to the same « Directed camera » workflow.
- **Rules kept:** quote before every spend, the language-model agent's cost is capped and shown, Comfy stays the only renderer of the final shot.
- Research behind this plan: the previs-mobile study of 16.10.2026 (not in the repo).

### Spending rules

A quote is shown before every spend; Create/Shoot stays off when the balance does not cover the required reserve (not a guaranteed billing cap). LTX-2.5 takes and the video gestures have no measured take yet: their quote is labelled « Estimé » / estimated (never shown as measured), the visitor confirms the estimate and its uncertainty, and the balance must cover the reserve. Running jobs are never cancelled by the studio on its own. Finalize only upscales/restores.

### Credits

Street-level references come from [Panoramax](https://panoramax.fr) (CC BY-SA: derived sets inherit share-alike) and OpenStreetMap/Photon. Google imagery is never sent to a model. Example character: Uttu (original design by the author).

---

## Français

### Sur la Comfy Developer Platform

Chaque rendu part sur le compte Comfy du visiteur par l’**API Comfy Cloud** documentée, via un relais même origine qui ne garde rien. Le studio ne vend rien et ne garde aucun compte ; les fichiers restent dans un coffre local.

- **CAST et DÉCOR :** FLUX 3 Image Klein (open weights) par défaut ; FLUX 3 Image (nœud partenaire) pour plusieurs références et la planche ; Nano Banana en option, éteinte par défaut.
- **PRISE :** LTX-2.5 par défaut (FLUX 3 Klein compose la première image à partir du personnage et du décor, puis LTX-2.5 l’anime, dans un seul graphe) ; MiniMax H3 en second moteur. Gestes vidéo : caméra maîtrisée (la maquette 3D filmée dans le navigateur sert de prévis ; profondeur MoGe + IC-LoRA LTX-2.3 rendent le plan), raccord LTX-2.5, caméra LTX-2.3 IC-LoRA, élargir le plan et effacer un objet (VFX, re-shoot).
- **MONTAGE :** voix, effet, musique (partenaires) ; Finaliser : RTX Video Super Resolution (étape du template `utility_nvidia_rtx_video_enhance`), sans jamais refaire le rendu.
- **Open weights seulement :** cache les gestes partenaires et les refuse avant envoi. La finalisation RTX, non vérifiée pour ce mode, reste fermée ; l’export MP4 local reste disponible.

### Workflows

Un fichier par geste dans `workflows/<onglet>/` : le template officiel (`.json`, à ouvrir dans ComfyUI) et, si le geste est branché, le graphe exact envoyé par le studio (`.api.json`). `workflows/index.json` dit lequel passe par un partenaire. Détail des gestes : [docs/WORKFLOWS.md](docs/WORKFLOWS.md).

### Lancer en local

```bash
npm ci && npm run dev   # http://localhost:3000/studio
```

Avec ton propre ComfyUI (open weights, sans crédit) : lance ComfyUI, ouvre un `workflows/…/*.json`, ou envoie le graphe exact du studio avec `node scripts/run-local.mjs <graphe.api.json> --text "…" --image nom=fichier`.

### Prévis au doigt (téléphone)
Dans PRISE, la maquette 3D se pilote au doigt : un doigt tourne la caméra ou déplace une personne, un objet ; deux doigts pincent. Le trajet caméra se construit par points-clés minutés (8 au plus sur 5 s, adoucis). « Phrase → scène » est un petit agent à règles (FR/EN/DE/ES, sans modèle de langue, sans réseau) qui place mannequins, objets et mouvement de caméra. Les objets sont des primitives ou un `.glb` importé, allégé sur l'appareil (20 000 triangles sur téléphone). « Filmer la prévis » enregistre 5 s du canvas (MediaRecorder) et envoie le clip directement dans « Caméra maîtrisée » (LTX-2.3 IC-LoRA). « Générer en 3D » passe par les templates officiels open weights `3d_hunyuan3d-v2.1` (personnage) et `3d_pixal3d_trellis2_image_to_model` (objet ou décor, décimé à 40 000 faces par le nœud du template), avec devis estimé et confirmation avant toute dépense.

### Étape suivante : Blender cloud via MCP (pas encore construit)
La v2 garde le téléphone comme éditeur three.js léger et laisse un agent piloter un Blender headless dans le cloud, pour des scènes plus riches et des passes profondeur/pose exactes :
- **Où tourne Blender :** un conteneur GPU facturé à la seconde (ex. Modal L4) ou un service Blender MCP géré comme Sceneplane (à tester, tarifs non vérifiés).
- **Comment l'agent le pilote :** des outils JSON stricts (`add_actor`, `set_camera_path`, `import_glb`, `render_previs`) traduits en `bpy`. L'addon `mcp-for-blender` exécute du Python arbitraire sur un socket sans authentification : uniquement derrière un réseau privé ou un tunnel SSH, jamais exposé.
- **Ce qui revient :** un GLB que le téléphone rouvre, et une prévis MP4 Eevee/Workbench (profondeur ou pose) envoyée au même workflow « Caméra maîtrisée ».
- **Règles gardées :** devis avant chaque dépense, coût de l'agent plafonné et affiché, Comfy reste le seul moteur du plan final.

### Règles de dépense

Un devis avant chaque dépense. La prise LTX-2.5 et les gestes vidéo n’ont pas encore de mesure : le devis est affiché « Estimé » (jamais « mesuré »), tu confirmes l’estimation et son incertitude ; le solde doit couvrir la réserve annoncée, qui ne garantit pas un plafond facturé. Finaliser agrandit et rend net, ne régénère jamais.

## Validation et sauvegardes / Validation and backups

La branche concours ne vaut pas validation de production. [Audit et intégration](docs/audit-2026-10-14/integration-concours.md) : preuves réelles, contrats simulés et opérations encore non validées sont distincts. Aucun appel payant effectué par cet audit.

Les projets restent dans le navigateur. Mon studio permet de demander sa protection contre l’éviction et d’exporter une copie ZIP indépendante. La protection ne survit pas à un effacement volontaire des données. Export local MP4 H.264/AAC : jusqu’à 60 s, 960×540 ou 540×960 à 12 images/s ; encodeur AAC local de secours.

Projects are stored in the browser. Request storage protection and download an independent ZIP backup from My Studio. Clearing browser data still removes local projects. Local MP4 export: H.264/AAC, up to 60 s, 960×540 or 540×960 at 12 fps, with a local AAC fallback encoder. Real cloud generation and physical-device validation remain separate acceptance steps.
