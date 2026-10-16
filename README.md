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

### Règles de dépense

Un devis avant chaque dépense. La prise LTX-2.5 et les gestes vidéo n’ont pas encore de mesure : le devis est affiché « Estimé » (jamais « mesuré »), tu confirmes l’estimation et son incertitude ; le solde doit couvrir la réserve annoncée, qui ne garantit pas un plafond facturé. Finaliser agrandit et rend net, ne régénère jamais.

## Validation et sauvegardes / Validation and backups

La branche concours ne vaut pas validation de production. [Audit et intégration](docs/audit-2026-10-14/integration-concours.md) : preuves réelles, contrats simulés et opérations encore non validées sont distincts. Aucun appel payant effectué par cet audit.

Les projets restent dans le navigateur. Mon studio permet de demander sa protection contre l’éviction et d’exporter une copie ZIP indépendante. La protection ne survit pas à un effacement volontaire des données. Export local MP4 H.264/AAC : jusqu’à 60 s, 960×540 ou 540×960 à 12 images/s ; encodeur AAC local de secours.

Projects are stored in the browser. Request storage protection and download an independent ZIP backup from My Studio. Clearing browser data still removes local projects. Local MP4 export: H.264/AAC, up to 60 s, 960×540 or 540×960 at 12 fps, with a local AAC fallback encoder. Real cloud generation and physical-device validation remain separate acceptance steps.
