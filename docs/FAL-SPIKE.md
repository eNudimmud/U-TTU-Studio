# C micro — rail fal expérimental

État de la reprise au 26 septembre 2026, suite à la PR #5, branche `cursor/fal-rail-spike-bada`.

## Décision produit

**C micro seulement : dataset gate → LoRA → image(s). Vente HOLD.** Look-Lock (A) reste KILL. Échéance : **8 octobre 2026, ou 1 CHF payant** selon la passation JD. Le spike ne lève pas le HOLD et ne modifie pas la PR #4 de doctrine UI.

Le code du spike est présent dans `main` : GitHub confirme la fusion de la PR #5 le 25 septembre 2026, commit `41ef200`. La PR #4 de doctrine UI est également fusionnée et ses changements sont conservés. Les corrections de cette reprise sont proposées dans une **PR de suivi DRAFT** ; Astra n’effectue aucune fusion. Le Worker n’a pas été déployé dans cette reprise ; son état distant n’est pas vérifié. Aucun appel fal réel ni dépense fal n’a été effectué par Astra.

La passation signale un smoke live PASS sur la machine U*TTU le 25 septembre : entraînement de 100 étapes, LoRA `.safetensors`, puis une image à 0,75. C’est une preuve rapportée de la boucle API sur dataset synthétique, **pas une validation de l’identité**. Elle n’a pas été répétée ici.

## Contrat et parcours

| Élément | Contrat |
| --- | --- |
| Gate Studio | Exactement **15 JPEG + 15 légendes**, et PASS dans l’interface. Le minimum fal de 4 images ne s’applique pas au Studio. |
| Entraînement | `fal-ai/flux-lora-fast-training`, `create_masks: true`, `is_style: false`, 1 000 étapes par défaut ; bornes serveur 20–2 000. |
| Résultat | `diffusers_lora_file.url`, configuration si fournie. Télécharger la LoRA pour la conserver. |
| Images | `fal-ai/flux-lora`, 1 024 × 1 024, une image par requête ; grille 0,60 / 0,75 / 0,90, même prompt et seed. |
| Sans URL proxy | Le bouton du lot est inactif (« proxy non branché »). L’entraînement fal reste fermé. Aucun appel automatique. L’import manuel des 15 images et le repli Comfy restent possibles. |
| Avec URL proxy | Le lot et l’entraînement demandent le code d’accès. L’URL présente ne prouve pas que le Worker répond. |
| Bootstrap 2–3 → 15 | `POST /bootstrap?trigger=…`, champ `refs` : 2 ou 3 images JPEG, PNG ou WebP. Le Worker dépose les références, puis met 15 fois `fal-ai/flux-pro/kontext/multi` en file. Réponse `202` : URL des références et 15 emplacements `{ index, id, angle, framing, variables, caption, seed }`. Les prompts sont ceux de `fal-bootstrap.ts`, pas ceux du navigateur. |
| Fichier généré | `GET /file?url=…` ne relaie qu’une URL `*.fal.media` ou le bucket `storage.googleapis.com/fal…`, sans suivre une redirection, sans envoyer la clé. Le navigateur s’en sert pour la revue du gate. |
| Repli | Comfy reste disponible, replié sous « Expert / repli », chargé au second clic. Ce n’est plus le chemin affiché à l’ouverture. |

Le navigateur réencode les images, puis envoie au Worker un ZIP réduit de 30 fichiers (`01.jpg` / `01.txt` à `15.jpg` / `15.txt`). Rapport, `gate.json` et noms de fichiers d’origine restent locaux. Le Worker revérifie la **forme** de ce ZIP ; il ne refait pas l’analyse des pixels ni la revue humaine. Un PASS n’est pas une promesse de fidélité de la LoRA.

## Coûts affichés

Les pages officielles fal, relues le 25 septembre 2026, indiquent 2 USD pour l’entraînement par défaut de 1 000 étapes, proportionnel aux étapes, et 0,035 USD par mégapixel pour l’image. Le code compte actuellement 1 024² pixels comme une unité facturée ; cette convention et les montants restent à rapprocher d’une facture.

| Plan | Estimation USD | Conversion indicative CHF |
| --- | --- | --- |
| Lot 2–3 → 15 (Kontext Pro, hypothèse 0,04 $ / image) | 0,60 $ | ≈ CHF 0,49 |
| 1 000 étapes + 1 image (script) | 2,04 $ | ≈ CHF 1,67 |
| 1 000 étapes + grille de 3 images | 2,11 $ | ≈ CHF 1,73 |

Taux fixe de calcul : **1 USD = 0,82 CHF, non vérifié**. Ce sont des frais fournisseur estimés, pas un prix de vente Studio. La clé du Studio paie les appels du proxy ; les crédits Comfy du repli restent sur le compte Comfy utilisé.

Sources : [entraînement fal](https://fal.ai/models/fal-ai/flux-lora-fast-training), [génération fal](https://fal.ai/models/fal-ai/flux-lora), [Kontext multi](https://fal.ai/models/fal-ai/flux-pro/kontext/multi/api), [tarif Kontext Pro](https://fal.ai/models/fal-ai/flux-pro/kontext) (0,04 $ / image, relu le 28 septembre 2026 ; le tarif propre au multi n’est pas distingué). Les arrondis monétaires sont testés ; ils ne prouvent pas la facturation effective.

## Smoke sans dépense

Depuis la racine du dépôt, avec un ZIP exporté par le gate :

```bash
npm run fal:smoke -- /chemin/vers/c-micro-dataset.zip
```

Sans `--live`, le script lit le ZIP, vérifie son format et affiche le plan : **0 réseau, 0 $**. Il refuse un `gate.json` présent dont le verdict n’est pas PASS. Sans manifeste, il vérifie seulement la forme et infère le trigger des légendes.

Le mode réel demande `--live` et `FAL_KEY` dans l’environnement du shell. `--max-usd` refuse un plan dont l’estimation dépasse le plafond (3 USD par défaut) ; ce n’est pas une limite de facturation chez fal. Tout nouveau run réel exige l’accord de JD et un budget annoncé. Aucun run réel n’appartient à la CI. La preuve API rapportée dans la passation suffit pour cette reprise.

## Secrets et vie privée

- `FAL_KEY` et `ACCESS_TOKEN` sont des secrets du Worker, jamais des variables `NEXT_PUBLIC_*`, des secrets de build Pages ou des fichiers commités. Le script utilise sa propre variable de shell `FAL_KEY`.
- Seule `NEXT_PUBLIC_FAL_PROXY_URL` est publique. Le chemin live est la variable d’environnement Vercel (Production et Preview). La modifier ou la vider exige un nouveau déploiement. Le catalogue Pages est figé.
- Le code d’accès est saisi dans le panneau fal et reste en mémoire jusqu’au rechargement. Il n’est transmis qu’au Worker.
- Les dépôts signés et téléchargements de fichiers se font sans clé fal. Les erreurs, journaux de progression et statuts inattendus relayés au navigateur masquent la clé.
- Le proxy demande une expiration de 24 h pour le ZIP et 7 jours pour les sorties, ainsi que `X-Fal-Store-IO: 0`. L’effacement effectif n’est pas vérifié ; les URL de fichiers peuvent être lues par qui les connaît.

## Checklist de revue et d’activation

| Contrôle | État / action |
| --- | --- |
| Suite de tests | **PASS — 83 tests, 0 échec, 0 ignoré** au 28 septembre 2026, dont le plan bootstrap (gate PASS), le refus d’1 ou 4 références, les prompts serveur et le relais de fichier contre un faux fal. 0 appel réseau réel. |
| Typage et export Pages | **PASS** — `npm run typecheck` et export statique avec `NEXT_PUBLIC_FAL_PROXY_URL` vide. Le HTML initial garde le gate verrouillé ; le JavaScript exporté n’inclut ni `FAL_KEY` ni le client serveur d’upload. |
| Bundle Worker | **PASS** — Wrangler 4.141.0, `deploy --dry-run` : 24,41 Kio (8,51 Kio gzip), sans déploiement. |
| CI de branche | Aucun workflow de PR au checkpoint. `pages.yml` exécute les tests sur `main` et sur lancement manuel ; les tests locaux ne sont pas un statut CI GitHub. |
| Secrets dans le client | Uniquement l’URL publique autorisée. `.env*`, `.dev.vars*`, `.wrangler/` et les sorties smoke sont ignorés. |
| Worker | Non déployé dans cette reprise. JD déploie par [GitHub Actions](../workers/fal-proxy/README.md#déployer-via-github-actions), ou par les [8 commandes](../workers/fal-proxy/README.md#déployer-jd--8-commandes) si Wrangler tourne en local. |
| Secrets Cloudflare | `FAL_KEY` et `ACCESS_TOKEN` à configurer par JD ; leur présence distante n’est pas vérifiée ici. |
| CORS | Origines exactes `https://u-ttu-studio.vercel.app` et `https://enudimmud.github.io` (sans `/U-TTU-Studio`). Vérifications HTTP sans appel fal dans le README Worker. |
| Variable Vercel | `NEXT_PUBLIC_FAL_PROXY_URL` en Production et Preview, après validation du Worker. Le chemin live n’est plus la variable Actions de Pages. Valeur distante non vérifiée. Vide = fal reste désactivé. |
| Mise en service | Après accord de fusion JD, redéployer Vercel avec la variable. Le catalogue Pages reste figé. |
| Commercialisation | HOLD ; qualité identité, coût réel et conditions d’exploitation restent à valider. |
| PR | PR #5 déjà fusionnée au checkpoint actuel ; corrections dans une PR de suivi DRAFT jusqu’au feu JD. Aucune fusion par Astra ; contenu de PR #4 conservé. |

L’activation Cloudflare n’est pas nécessaire pour relire ou fusionner le spike désactivé. Elle est nécessaire pour l’utiliser depuis le navigateur. Les captures mobile sont hors validation de cette reprise.

## Suites possibles

Avant un accès plus large, ajouter une limite de débit et un contrôle d’accès individuel : le code partagé autorise des dépenses sans plafond global. La limite CPU du plan Workers gratuit est de 10 ms par requête ; la tenue d’un ZIP réel n’est pas mesurée. Le lecteur saute le CRC dans le Worker, contrairement au smoke. En cas de dépassement, évaluer un plan adapté ou un dépôt signé direct, sans élargir le produit au-delà de C micro.
