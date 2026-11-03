# Démo P0 — séquence de 3 plans (brouillon)

**Statut : brouillon. Les compositions sont à faire valider par JD avant toute génération.** Aucun rendu n'est lancé par Cursor : JD lance les rendus payants lui-même sur la preview.

Personnages et lieu : **Enki**, **Fizz**, **le Blanche Of Castille**. Aucun autre personnage, aucune nouvelle identité.

## Références disponibles (vérifiées le 01.11.2026)

Les originaux sont dans le coffre du navigateur de JD (pas dans ce dépôt). Le job FLUX.2 `d107aeb5` et le graphe Klein du 31.10 donnent leur ordre d'envoi et leur nom de fichier côté Comfy (empreinte SHA-256) :

| Référence | Catégorie | Photos (ordre d'envoi) | Remarque |
|---|---|---|---|
| Enki | CAST | 3 : face, dos, sur les nuages (lapin blanc, manteau jaune, sweat rouge au logo, pantalon vert) | `07bb3297…png`, `271db430…png`, `881066c6…png` |
| Fizz | CAST | 2 : photo plein cadre (fennec bleu-gris, **sans vêtements**) + **planche** d'environ 20 vues | `74da3d0e…jpg`, `0830a086…png` |
| Blanche Of Castille | DÉCOR | 2 : vue héros (cité flottante rouge et or au-dessus des nuages) + **planche de design** d'environ 11 vignettes | `9a74d8e4…png`, `a3a0a633…png` |

Règle pour la démo : **une vue propre par personnage au minimum, jamais la planche seule** ; 3 images maximum par référence.

## Scénario proposé (à valider par JD)

Format 16:9, plans courts.

| Plan | Phrase (bulle / storyboard) | Refs | Ce que le plan prouve |
|---|---|---|---|
| 1 — Plan large | « @Blanche Of Castille au lever du soleil, au-dessus d'une mer de nuages, travelling lent vers le pont. » | DÉCOR seul | Le lieu est respecté, sans personnage inventé |
| 2 — Plan moyen | « Sur le pont du @Blanche Of Castille, @Enki tend la main vers @Fizz qui s'approche, prudent. » | Enki, Fizz, Blanche | Deux identités distinctes, **sans mélange** (Fizz reste un fennec nu, Enki garde son manteau) |
| 3 — Gros plan | Modification ciblée du plan 2 : « Même plan, Fizz saute sur l'épaule d'Enki. » | Enki, Fizz, Blanche | Modification ciblée, mêmes identités, même lieu |

## Critères d'acceptation par étape P0

| Étape | Critère | Preuve attendue |
|---|---|---|
| Intention | Une phrase dans la bulle crée un storyboard de 3 plans | Capture + `.uttu/sb-*.json` |
| Uttu Agent | Selon la décision d'Astra : l'agent propose ou reformule les plans ; rien n'est lancé sans confirmation | Transcription du fil |
| Storyboard | 3 plans, chacun avec ses @références correctes (plan 1 : DÉCOR seul) | Capture `/storyboard` aux 4 tailles |
| Workflow | Pour chaque plan, le graphe envoyé contient exactement les images de ses références, aucune planche quand une vue propre existe, et un texte qui nomme chaque personnage séparément | Graphe JSON enregistré (test simulé) |
| Génération Comfy | Devis « ≈ X crédits estimés » affiché, un seul envoi par confirmation, aucun job annulé | Identifiants de job, coût réel lu |
| Résultat associé au plan | Chaque prise est rangée sous `sb-<storyboard>-<plan>` dans le registre et visible sur sa carte | `.uttu/registre-plans.json` + capture |
| Export | Les 3 plans sur la timeline, export téléchargé, résolution affichée sur le bouton | Fichier MP4 + capture |
| Mélange d'identités | Revue visuelle par JD : Fizz sans vêtements, Enki reconnaissable, aucun panneau de planche visible | Images côte à côte |

## Budget (à confirmer par JD)

- Klein : ≈ 10–14 crédits estimés par image avec références → ≈ 40 crédits estimés pour 3 plans fixes.
- FLUX.2 dev : ≈ 35 crédits par image (une prise mesurée, prix non confirmé) → ≈ 105 crédits estimés.
- Vidéo (LTX / H3) : à chiffrer plan par plan avec le devis du studio.
- Plafond global du concours : 300 crédits.
