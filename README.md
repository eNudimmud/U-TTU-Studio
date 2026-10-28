# U*TTU Studio

**Open-source AI film studio on ComfyUI: direct your shot in 3D on your phone, LTX films it.**

Block your actors and the camera path with a finger in a 3D mock-up (previs). The studio records that mock-up in the browser, and LTX-2.3 IC-LoRA re-shoots it on your character and set with the same camera move. A film goes through five steps (CAST · SET · TAKE · EDIT · FINALISE); every render runs on your own Comfy Cloud account, with a quote before any credit is spent.

**FR** — *Studio de cinéma IA open source sur ComfyUI : mets en scène ton plan en 3D sur ton téléphone, LTX le tourne.* Tu places tes personnages et le trajet de la caméra au doigt dans une maquette 3D ; le studio la filme dans le navigateur, et LTX-2.3 IC-LoRA retourne le plan avec ton personnage et ton décor, au même mouvement de caméra. Un film passe par cinq étapes (CAST · DÉCOR · PRISE · MONTAGE · FINALISER) ; chaque rendu passe par ton compte Comfy Cloud, avec un devis avant chaque crédit.

Live: <https://u-ttu-studio.vercel.app/studio> · License: [MIT](LICENSE) · Languages: FR (source), EN, DE, ES.

<p>
<img src="docs/screenshots/readme-entree-1280.jpg" width="49%" alt="Entry, 1280 px">
<img src="docs/screenshots/readme-cast-1280.jpg" width="49%" alt="CAST, 1280 px">
</p>
<p>
<img src="docs/screenshots/readme-prise-1280.jpg" width="49%" alt="TAKE, 1280 px">
<img src="docs/screenshots/readme-outils-1280.jpg" width="49%" alt="Comfy tools, 1280 px">
</p>
<p>
<img src="docs/screenshots/readme-entree-390.jpg" width="32%" alt="Entry, 390 px">
<img src="docs/screenshots/readme-cast-390.jpg" width="32%" alt="CAST, 390 px">
<img src="docs/screenshots/readme-mes-creations-390.jpg" width="32%" alt="My creations, 390 px">
</p>

<sub>Real screenshots of the live studio (English, 1280 px and 390 px, 28 October 2026). No account linked, so no render of yours is shown.</sub>

## Principles / Principes

**EN**

- **A quote before every credit.** Every paid button shows « ≈ X credits estimated » (or measured, once a real job was billed) and asks for a confirmation; the balance must cover the reserve.
- **One gesture = one exported Comfy workflow.** Each gesture has its official template and the exact API graph the studio sends in [`workflows/`](workflows).
- **Finalise improves, never regenerates.** It upscales and cleans the frames already made; sound and timing stay.
- **Your Comfy account.** Renders run on your own Comfy Cloud account; the studio has no server-side key, no account of its own, and sells nothing.
- **Open weights possible.** « Open weights only » hides partner gestures, and `scripts/run-local.mjs` sends the same graphs to your own ComfyUI.

**FR**

- **Un devis avant chaque crédit.** Chaque bouton payant montre « ≈ X crédits estimés » (ou mesurés, une fois un vrai job facturé) et demande une confirmation ; le solde doit couvrir la réserve.
- **Un geste = un workflow Comfy exporté.** Chaque geste a son template officiel et le graphe API exact envoyé par le studio dans [`workflows/`](workflows).
- **Finaliser améliore, ne régénère jamais.** Il agrandit et nettoie les images déjà faites ; le son et la cadence restent.
- **Ton compte Comfy.** Les rendus partent sur ton propre compte Comfy Cloud ; le studio n’a ni clé côté serveur, ni compte à lui, et ne vend rien.
- **Open weights possible.** « Open weights seulement » cache les gestes partenaires, et `scripts/run-local.mjs` envoie les mêmes graphes à ton propre ComfyUI.

## What is in the studio / Ce qu’il y a dans le studio

- **Repérage / Scouting:** a real place becomes your set: a 3D view of the block (OpenStreetMap buildings and terrain), plus street photos from Panoramax, Wikimedia Commons and KartaView (Mapillary where covered), each with its author and licence. / *Un vrai lieu devient ton décor : une vue 3D du quartier, plus des photos de rue Panoramax, Wikimedia Commons et KartaView (Mapillary selon couverture), chacune avec son auteur et sa licence.*
- **Maquette 3D / 3D layout:** place people, props and the camera path with a finger, then film the previs for « Directed camera ». / *Place personnages, objets et trajet caméra au doigt, puis filme la prévis pour « Caméra maîtrisée ».*
- **Synchroniser les lèvres / Lip sync:** a video and a voice, the lips follow (sync.so, partner). / *Une vidéo et une voix, les lèvres suivent (sync.so, partenaire).*
- **Aperçu / Qualité finale (Preview / Final quality):** an LTX take can start as a cheaper preview (about 480p, same seed), finalised later on its own or with the whole edit. / *Une prise LTX peut partir en aperçu, moins cher (environ 480p, même graine), puis se finaliser seule ou avec tout le montage.*
- **Retoucher / Retouch:** edit, finalise, widen, cut out or relight an image; the original is never replaced. / *Modifier, finaliser, élargir, détourer ou rééclairer une image ; l’original n’est jamais remplacé.*
- **Pars d’un exemple / Start from an example:** renders made in the studio on Comfy, under the bar; tap one and it fills the bar. / *Des rendus faits dans le studio sur Comfy, sous la barre ; un toucher et la barre se remplit.*
- **37 tools / 37 outils:** 34 integrated Comfy tools (57 model cards), [OpenJutsu in the official Comfy app](docs/OPENJUTSU.md), plus « Scout a location » and « 3D layout and framing ». / *34 outils Comfy intégrés (57 cartes de modèles), [OpenJutsu dans l’app officielle Comfy](docs/OPENJUTSU.md), plus « Repérer un lieu » et « Maquette 3D et cadrage ».*

## For the jury / Pour le jury

**EN**

1. Open <https://u-ttu-studio.vercel.app> on a computer or a phone. The page follows your browser language (FR, EN, DE or ES, English otherwise); the language menu switches it and keeps your choice.
2. **Discover with Uttu** opens the studio. Start from the bar **Image · Video · Agent** (type what you want) or from **Start from an example**, then follow the five steps **CAST → SET → TAKE → EDIT → Finalise**. Everything that launches no render works without an account: Uttu the local guide (getting started, FAQ, cost simulator), the examples, scouting and the 3D layout, the timeline in EDIT, project export.
3. **To render, link your own Comfy account:** **Credits → Connect the render account → Sign in with Comfy**, or paste a Comfy Cloud API key (a paid Comfy Cloud plan is needed). Session and key stay in your browser; the studio has no server-side key and no account of its own.
4. Every paid button shows its quote first and asks for a confirmation. Current prices for a 5-run path:
   - CAST « From text »: ≈ 4 credits (measured);
   - SET « From text »: ≈ 4 credits (measured);
   - TAKE with the default LTX engine, 5 s 16:9: ≈ 15 credits, 23 at most (measured on 27.10.2026: 14.55 to 15.10 credits; the app still labels this quote « estimated »); a preview take: ≈ 6 credits estimated;
   - EDIT: the timeline and the local MP4 export spend no credits;
   - Finalise the edit (1080p): ≈ 4.1 credits for 5 s (measured).
5. The studio never cancels a Comfy job. If you stop waiting, the job keeps running on your account and lands in My creations.
6. Optional **Comfy agent**: once linked, switch Uttu to « Comfy agent ». It answers in its own words through Comfy Router (≈ 0.2 credits estimated per message at most, paid by your Comfy account) and launches nothing: it suggests, you click.
7. Without Comfy Cloud: « Run locally » below (`scripts/run-local.mjs` with your own ComfyUI, open weights).

**FR**

1. Ouvre <https://u-ttu-studio.vercel.app> sur ordinateur ou téléphone. La page suit la langue de ton navigateur (FR, EN, DE ou ES, sinon l’anglais) ; le menu de langue la change et garde ton choix.
2. **Découvrir avec Uttu** ouvre le studio. Pars de la barre **Image · Vidéo · Agent** (écris ce que tu veux) ou de **Pars d’un exemple**, puis suis les cinq étapes **CAST → DÉCOR → PRISE → MONTAGE → Finaliser**. Tout ce qui ne lance aucun rendu marche sans compte : Uttu, le guide local (premiers pas, FAQ, simulateur de coûts), les exemples, le repérage et la maquette 3D, la timeline de MONTAGE, l’export du projet.
3. **Pour rendre, relie ton propre compte Comfy :** **Crédits → Relier le compte de rendu → Se connecter avec Comfy**, ou colle une clé API Comfy Cloud (un abonnement Comfy Cloud payant est nécessaire). Session et clé restent dans ton navigateur ; le studio n’a ni clé côté serveur ni compte à lui.
4. Chaque bouton payant montre d’abord son devis et demande une confirmation. Prix actuels pour un parcours en 5 rendus :
   - CAST « Depuis un texte » : ≈ 4 crédits (mesuré) ;
   - DÉCOR « Depuis un texte » : ≈ 4 crédits (mesuré) ;
   - PRISE avec le moteur LTX par défaut, 5 s 16:9 : ≈ 15 crédits, 23 au plus (mesuré le 27.10.2026 : 14,55 à 15,10 crédits ; l’app affiche encore ce devis « estimé ») ; une prise en aperçu : ≈ 6 crédits estimés ;
   - MONTAGE : la timeline et l’export MP4 local ne dépensent aucun crédit ;
   - Finaliser le montage (1080p) : ≈ 4,1 crédits pour 5 s (mesuré).
5. Le studio n’annule jamais un job chez Comfy. Si tu arrêtes d’attendre, le rendu continue sur ton compte et arrive dans Mes créations.
6. **Agent Comfy** en option : une fois relié, passe Uttu en « Agent Comfy ». Il répond avec ses mots via Comfy Router (≈ 0,2 crédit estimé par message au plus, payé par ton compte Comfy) et ne lance rien : il propose, tu cliques.
7. Sans Comfy Cloud : « Lancer en local » plus bas (`scripts/run-local.mjs` avec ton propre ComfyUI, open weights).

## What is measured, and what is not / Ce qui est mesuré, et ce qui ne l’est pas

**EN** — The registry lists 79 gestures. **38 have a real billed run**; 31 of them were measured on 27.10.2026 (visitor test and example batch, Comfy billing read job by job, no credit spent for the reading). Every job and its cost: [docs/mesures/test-visiteur-2026-10-27.md](docs/mesures/test-visiteur-2026-10-27.md). The other gestures are wired and tested against a simulated Comfy, and their quote is labelled « estimated », or stay closed.

**FR** — Le registre compte 79 gestes. **38 ont un vrai rendu facturé** ; 31 ont été mesurés le 27.10.2026 (test visiteur et lot d’exemples, facturation Comfy lue job par job, aucun crédit dépensé pour la lecture). Chaque job et son coût : [docs/mesures/test-visiteur-2026-10-27.md](docs/mesures/test-visiteur-2026-10-27.md). Les autres gestes sont branchés et testés contre un Comfy simulé, avec un devis « estimé », ou restent fermés.

Measured costs, in credits / Coûts mesurés, en crédits :

| Step / Étape | Gesture / Geste (measured / mesuré) |
|---|---|
| CAST | from text / depuis un texte ≈ 4 · from photos / depuis des photos 3,57 |
| DÉCOR | from text / depuis un texte ≈ 4 · from a photo / depuis une photo 2,53 · time of day / heure 4,42 |
| PRISE | LTX-2.5 5 s 15,10 · MiniMax H3 3,66 · bridge / raccord 6,98 · widen / élargir 16,32 · remove an object / effacer 25,11 · 3D object / objet 3D 16,65 |
| After a take / Après une prise | edit / modifier 3,81 · finalise image 1,56 · cut out / détourer 0,58 · widen image / élargir 5,18 · finalise video / finaliser vidéo (5 s → 1080p) 27,50 · smooth / fluidifier 2,01 · continue / prolonger 6,11 · make it talk / faire parler 8,09 |
| Finaliser (edit / montage) | 4,1 for 5 s, 4,5 for 30 s (14.10.2026) |
| Tools / Outils, image | Klein 3,49 · Qwen 3,00 · FLUX 3 14,48 · Ideogram 18,1 · GPT Image 1,26 · Seedream 9,5 · references / références 2,01 · 360° 20,00 · sketch / croquis 16,84 |
| Tools / Outils, video | text to video / texte → vidéo 4,72 · Wan 8,44 · Vidu 100,23 · motion / mouvement 16,59 · cut out / détourer 63,3 · lip sync / lèvres 277,57 |
| Tools / Outils, sound | open voice / voix ouverte 2,80 · dialogue 3,57 · open music / musique ouverte 3,37 · sound effect / bruitage 1,66 |

The example media in `public/exemples/` say how they were made (`public/exemples/A-GENERER.json`, cost per item) / Les exemples de `public/exemples/` disent comment ils ont été faits :
- The SET stills (quay, rainy street, rooftop, station) are **FLUX 3 Image Klein** (open weights); three CAST portraits and two sets are **Seedream 4.5** (partner), all via Comfy Cloud. / *Les décors sont en FLUX 3 Image Klein ; trois portraits CAST et deux décors en Seedream 4.5 (partenaire).*
- « After » examples rendered on 8 October 2026 with **Nano Banana 2.1** and the `templates-character_sheet` template (partner) are kept as they are: CAST from text, from photos and view sheet, SET from text and time of day. / *Les « après » du 8 octobre 2026 en Nano Banana 2.1 et planche (partenaire) restent tels quels.*
- The 27.10.2026 batch (40.19 credits) added **Klein** (SET from a photo, retouch « snow », set from the 3D view), **SeedVR2** (finalise an image), an **LTX-2.5** take (`outils/prise-uttu-quai.mp4`, 9.87 credits) and a **Wan 2.2** clip (`outils/wan-gare.mp4`, 8.44). / *Le lot du 27.10.2026 (40,19 crédits) a ajouté Klein (décor depuis une photo, retouche « neige », décor depuis la vue 3D), SeedVR2, une prise LTX-2.5 et un clip Wan 2.2.*
- `public/exemples/outils/plan-exemple.mp4` (3 s) is a sample clip to try the video tools, **not** a render from a video model. / *C’est un clip pour essayer les outils vidéo, pas un rendu d’un modèle vidéo.*

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

Next step, not built: cloud Blender over MCP, see [docs/BLENDER-MCP.md](docs/BLENDER-MCP.md).

### Spending rules

A quote is shown before every spend; Create/Shoot stays off when the balance does not cover the required reserve (not a guaranteed billing cap). A quote says « measured » only for a gesture with a billed job ([docs/mesures](docs/mesures/test-visiteur-2026-10-27.md)); otherwise it is labelled « estimated » and the visitor confirms the estimate and its uncertainty. The LTX take was billed on 27.10.2026 (about 15 credits for 5 s), but the take quote in the app is still labelled « estimated ». Running jobs are never cancelled by the studio on its own. Finalize only upscales/restores.

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

Étape suivante, pas encore construite : Blender cloud via MCP, voir [docs/BLENDER-MCP.md](docs/BLENDER-MCP.md).

### Règles de dépense

Un devis avant chaque dépense. Un devis ne dit « mesuré » que pour un geste dont un job a été facturé ([docs/mesures](docs/mesures/test-visiteur-2026-10-27.md)) ; sinon il est affiché « estimé », et tu confirmes l’estimation et son incertitude. La prise LTX a été facturée le 27.10.2026 (environ 15 crédits pour 5 s), mais son devis reste affiché « estimé » dans l’app ; le solde doit couvrir la réserve annoncée, qui ne garantit pas un plafond facturé. Finaliser agrandit et rend net, ne régénère jamais.

## Validation et sauvegardes / Validation and backups

La branche concours ne vaut pas validation de production. [Audit et intégration](docs/audit-2026-10-14/integration-concours.md) : preuves réelles, contrats simulés et opérations encore non validées sont distincts. Aucun appel payant effectué par cet audit.

Les projets restent dans le navigateur. Mes créations permet de demander sa protection contre l’éviction et d’exporter une copie ZIP indépendante. La protection ne survit pas à un effacement volontaire des données. Export local MP4 H.264/AAC : jusqu’à 60 s, 960×540 ou 540×960 à 12 images/s ; encodeur AAC local de secours.

Projects are stored in the browser. Request storage protection and download an independent ZIP backup from My creations. Clearing browser data still removes local projects. Local MP4 export: H.264/AAC, up to 60 s, 960×540 or 540×960 at 12 fps, with a local AAC fallback encoder. Real cloud generation and physical-device validation remain separate acceptance steps.
