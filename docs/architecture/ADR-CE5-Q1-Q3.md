# ADR — CE5 décisions D1 à D3

Statut : accepté pour le lot B4, réversible sans migration.
Date : 2026-11-02.

Ces trois décisions répondent aux questions ouvertes de la [PR #228](https://github.com/eNudimmud/U-TTU-Studio/pull/228) (commentaire « Questions pour Astra », tête CE5). La question 4 (`acknowledgeOverrun` sans écran) n'est pas traitée ici : c'est le lot B5.

## D1 — question 1

> Un reçu d'intent en conflit (`succeeded`) bloque l'intent suivant sans action de résolution : quelle sortie (abandon explicite, rebase manuel) — en U1.1 ?

**Décision.** Commande headless `resolveConflictedIntent(operationId, "abandon")`, aussi exposée comme `abandonIntent`. Elle écrit `event: "intent.abandoned"` sur le journal en conflit. Elle n'écrit ni le storyboard, ni le sidecar, ni les copies de conflit. Le reçu passe à `settled` avec `settlement: "abandoned"` (le job est déjà fini : rien n'est annulé), donc l'intention suivante n'est plus bloquée. Rebase viendra après le gel.

**Retour arrière.** Retirer la commande. Le champ `event` est optionnel : un journal déjà marqué reste lisible, son état reste `conflict`.

## D2 — question 2

> Journaux `applied` conservés : un par sauvegarde dans `.uttu/`, tous listés par `recoverJournals`. Politique d'élagage (N derniers, âge) ?

**Décision.** `JOURNAL_KEEP = 20` : les 20 journaux `applied` les plus récents (`updatedAt`) par board. Tous les journaux non appliqués (`prepared`, `rolled_back`) et tous les journaux `conflict` sont gardés. L'élagage a lieu à la fin de chaque transaction, sous le verrou projet. Un journal dont l'`operationId` figure dans `.uttu/receipt-guard.json` n'est jamais supprimé. Le contrôleur y recopie le reçu d'intention ouvert et, s'il y en a un, le reçu de prise ouvert (`operationId`, et les journaux `attemptId.take` / `attemptId.projection` du règlement). Un garde illisible suspend l'élagage. `JOURNAL_KEEP = Infinity` le désactive.

**Retour arrière.** Mettre `JOURNAL_KEEP` à `Infinity`. Aucun fichier n'est réécrit.

## D3 — question 3

> Réservations orphelines sans reçu toujours libérées en `never_sent` (le reçu est écrit avant le POST) ; or dans `submitApprovedIntent` la réserve précède `writeReceipt`. OK de traiter « pas de reçu » comme preuve durable, ou inverser l'ordre ?

**Décision.** Garder l'ordre `hold` puis `writeReceipt` : un reçu sans réserve sous-compterait. Si `writeReceipt` lève, appeler `budget.refused(attemptId)` tout de suite — la réserve est libérée en `never_sent`, rien n'est parti — puis relancer l'erreur. Zéro POST.

**Retour arrière.** Retirer le `try/catch`. La libération redevient celle du rechargement.
