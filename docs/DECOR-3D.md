# Décor depuis la 3D : la vue garde le cadrage, les photos donnent l’apparence

Étape 3 du Repérage 3D (« Créer le décor »). Un seul rendu Comfy, FLUX.1 dev, 1024×576.

> Les photos donnent l’apparence ; la 3D garde le cadrage.

Le studio n’annonce pas de projection des photos sur les volumes (pas d’UV). Une photo ne place
rien : ni bâtiment, ni caméra, ni horizon.

## Le graphe (`src/lib/render/decor-3d.ts`)

| Rôle | Entrée | Nœuds |
| --- | --- | --- |
| Structure | la vue 3D gardée (`uttu-cadre-3d.png`) | Lotus depth (`lotus-depth-d-v1-1`) → ImageInvert → `InstructPixToPixConditioning.pixels`, modèle FLUX + LoRA `flux1-depth-dev-lora` à 1 |
| Apparence | 0 à 3 photos du lieu (`uttu-lieu-N.jpg`) | `CLIPVisionEncode` (sigclip 384, centre) → `StyleModelApply` (`flux1-redux-dev`, attn_bias, 0,1 par photo) |
| Texte | `cadrePrompt` (decor-cadre.ts) | `CLIPTextEncode` → FluxGuidance 10 |

- La structure reste active à chaque pas : la LoRA depth est sur le modèle et la profondeur est
  concaténée au latent à tous les pas (cfg 1, euler/simple, 20 pas). Pas de fin anticipée.
- Départ en bruit pur (denoise 1). Le départ « vue » (VAEEncode de la vue 3D, débruitage partiel)
  existe pour la mesure ; il donne un rendu gris ou délavé (voir la mesure), il n’est pas utilisé.
- Une photo ne touche jamais un VAEEncode, le latent ni la profondeur. Les tests le vérifient en
  suivant le graphe (`tests/decor-cadre.test.ts`, `e2e/reperage-3d.spec.ts`).
- Le prompt décrit une photo réelle (« Photorealistic photograph… »), il ne donne pas d’ordre
  sur les images. `CADRE_NEGATIVE` est gardé dans le graphe, mais à cfg 1 il n’a pas d’effet
  mesurable : le texte positif dit déjà « no checkerboard façades ».

## Le poids des photos : un réglage, pas une garantie

Redux pousse aussi la composition de la photo. Mesuré (docs/mesures/decor-3d-2026-10-29.md) :

- à 0,6 la matière passe très fort, mais sur une vue au sol plat (Central Park) la photo impose son
  propre cadrage : la ligne du sol descend de 235 px ;
- à 0,1 la ligne du sol tient (4 px) et les silhouettes des volumes restent ≥ 0,85 d’IoU ;
  la pierre et la brique passent, le verre passe mal.

Défaut : **0,1 attn_bias** (`DECOR_3D_STYLE_STRENGTH`). Le cadrage d’abord.

## Fichiers

- `workflows/decor/decor-3d-apparence.api.json` : le graphe exact envoyé (3 photos, texte témoin).
- `workflows/decor/decor-3d-apparence.json` : le template officiel `flux_depth_lora_example`,
  et `decor-3d-apparence-redux.json` : `flux_redux_model_example` (les deux templates chaînés).
- Devis : `cadreQuote` → ≈ 6 crédits estimés, 9 au plus, toutes photos confondues.
- L’ancien chemin InstantX (`instantx-cadre.ts`) reste pour les reçus `depth-control`.
- Mesure : `scripts/mesures/` (scène à 3 volumes, IoU, ligne du sol, capture du repérage).
