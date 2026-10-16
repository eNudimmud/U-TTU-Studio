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
| PRISE (video gestures) | LTX-2.5 first/last frame bridge, LTX-2.3 IC-LoRA camera, LTX-2.3 video outpainting and object removal (VFX / re-shoot) | `video_ltx2_5_flf2v`, `video_ltx2_3_ic_lora`, `template_ltx2_3_lora_video_outpainting`, `template_ltx2_3_obscura_remova_lora_remove_object_from_video` | open |
| MONTAGE | voice, sound effect, music | ElevenLabs, Sonilo partner templates | partner |
| Finalize | SeedVR2 restore/upscale, frame interpolation (never regenerates) | `utility_seedvr2_*`, `utility_video_frame_interpolation` | open (+ partner options) |

Nano Banana stays available as an **option, off by default** (toggle « Nano Banana (option) »). **Open weights only** hides every gesture whose graph contains a partner node. Both toggles sit above the gesture cards; the PRISE tab has an engine switch (LTX-2.5 default / MiniMax H3).

### Workflows

[`workflows/`](workflows) holds one Comfy workflow per gesture:

- `workflows/<tab>/<gesture>.json` — the official Comfy template the gesture comes from (UI format: drag it into ComfyUI);
- `workflows/<tab>/<gesture>.api.json` — the exact API graph the studio sends, for wired gestures (placeholders `uttu-*.jpg` and `<texte du visiteur>`);
- `workflows/index.json` — gesture → template, partner nodes, files. `tests/workflows-export.test.ts` keeps it equal to the registry ([`src/lib/workflows/registre.ts`](src/lib/workflows/registre.ts)).

Regenerate: `node --experimental-strip-types scripts/export-workflows.mjs` (reads templates from `Comfy-Org/workflow_templates`, partner flags from a local ComfyUI `/object_info` when one runs).

### Run locally

Requirements: Node ≥ 22.

```bash
npm install
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

### Spending rules

A quote is shown before every spend; Create/Shoot stays off when the balance does not cover the ceiling. LTX-2.5 takes and the video gestures have no measured take yet: their quote is labelled « Estimé » / estimated (never shown as measured), the visitor confirms the estimated maximum, and the balance must cover it. Running jobs are never cancelled by the studio on its own. Finalize only upscales/restores.

### Credits

Street-level references come from [Panoramax](https://panoramax.fr) (CC BY-SA: derived sets inherit share-alike) and OpenStreetMap/Photon. Google imagery is never sent to a model. Example character: Uttu (original design by the author).

---

## Français

### Sur la Comfy Developer Platform

Chaque rendu part sur le compte Comfy du visiteur par l’**API Comfy Cloud** documentée, via un relais même origine qui ne garde rien. Le studio ne vend rien et ne garde aucun compte ; les fichiers restent dans un coffre local.

- **CAST et DÉCOR :** FLUX 3 Image Klein (open weights) par défaut ; FLUX 3 Image (nœud partenaire) pour plusieurs références et la planche ; Nano Banana en option, éteinte par défaut.
- **PRISE :** LTX-2.5 par défaut (FLUX 3 Klein compose la première image à partir du personnage et du décor, puis LTX-2.5 l’anime, dans un seul graphe) ; MiniMax H3 en second moteur. Gestes vidéo : raccord LTX-2.5, caméra LTX-2.3 IC-LoRA, élargir le plan et effacer un objet (VFX, re-shoot).
- **MONTAGE :** voix, effet, musique (partenaires) ; Finaliser : SeedVR2 et interpolation, sans jamais refaire le rendu.
- **Open weights seulement :** cache tous les gestes à nœud partenaire.

### Workflows

Un fichier par geste dans `workflows/<onglet>/` : le template officiel (`.json`, à ouvrir dans ComfyUI) et, si le geste est branché, le graphe exact envoyé par le studio (`.api.json`). `workflows/index.json` dit lequel passe par un partenaire. Détail des gestes : [docs/WORKFLOWS.md](docs/WORKFLOWS.md).

### Lancer en local

```bash
npm install && npm run dev   # http://localhost:3000/studio
```

Avec ton propre ComfyUI (open weights, sans crédit) : lance ComfyUI, ouvre un `workflows/…/*.json`, ou envoie le graphe exact du studio avec `node scripts/run-local.mjs <graphe.api.json> --text "…" --image nom=fichier`.

### Règles de dépense

Un devis avant chaque dépense. La prise LTX-2.5 et les gestes vidéo n’ont pas encore de mesure : le devis est affiché « Estimé » (jamais « mesuré »), tu confirmes le maximum estimé et le solde doit le couvrir. Finaliser agrandit et rend net, ne régénère jamais.
