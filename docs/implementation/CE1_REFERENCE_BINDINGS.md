# CE1 — Reference bindings up to the graph

Batch CE1 of [CINEMA_LOTS](CINEMA_LOTS.md). Stacked on CE0 `210d7fe`, whose types are used and not edited.
Headless only: `studio-session.tsx` belongs to CE5, and messages and styles to CE4.

## Services

| Step | File | Pure? | What it does |
|---|---|---|---|
| resolve | `cinema/references.ts` `resolveReferences` | yes | Turns the shot's `qui/ou/objet/style` into `ReferenceBinding`s, by project, category and id. A ref without an id matches by name only in the same project and category, and two cards with that name are `REFERENCE_AMBIGUOUS`. An unknown ref, or a card with no pixels, gives `REFERENCE_MISSING`, blocks the shot, and creates no identity. |
| prepare | `cinema/reference-preparation.ts` `prepareReferences` | async, ports | Reads, hashes and classifies each picture (`clean`, `sheet`, `unreadable`, `missing`), with a cache by SHA-256. An unreadable picture is never clean. A card that is all sheets still sends its sheet, with `SHEET_ONLY`. A card with nothing readable gives `REFERENCE_MISSING`. |
| compile | `cinema/references.ts` `compileReferences` | yes | Produces the ordered asset ids and one slot per binding. Identities are balanced: 1 to 2 views, never more than the scarcest. Each required binding gets at least one picture or the shot is refused; nothing is dropped. Shared files point at one index. |
| name | `cinema/references.ts` `slotPrompt` | yes | One sentence per slot, by role. Several identities are « different characters ». The place, objects and style give no features to anyone. |
| snapshot | `cinema/snapshot.ts` `shotSnapshot` | yes (Web Crypto) | Builds an immutable `ShotSnapshot` of one shot. Its digest covers the creative fields, bindings with picture hashes, locks, seed, length, size, prompt, picture order, slots and workflow digest. |
| collection | `checkCollections` | yes | A collection of several cards for one identity must be complete, or the shot is refused. The list comes from the project. |
| keyframe | `isApprovedKeyframe`, `keyframeVideoPictures`, `keyframeReadiness` | yes | P0 path: the approved keyframe goes alone into the one-picture LTX graph. A raw CAST photo is not a keyframe. `keyframeReadiness` gives the state of CE4's `[data-sb-keyframe]` button. |

## Changes to existing files (additive)

- `storyboard/film.ts`: `EnvoiPlan.references` carries every ref of the shot, objects and style included. The historical fields are unchanged.
- `render/ltx-graph.ts`:
  - New optional `roles` input (the `slotPrompt` text with `<ref_image_i>` tags). With it, the first-frame text no longer assumes « the person from `<ref_image_0>` in the place from the last picture ». The framing guide stays a layout guide, and the identities are named by their slots.
  - Without `roles`, the historical text is byte-identical.
  - The builder now **refuses** more than 4 pictures instead of silently cutting the last one. `run.ts` already refused above the limit, so no caller changes.
- `render/run.ts`: `takeGraphFor(…, roles?)` passes `roles` through.

## Raccord for CE5 (studio-session, not done here)

```ts
const envoi = versPlanFilm(sb, plan, cards);
const resolved = resolveReferences({ projectId, refs: envoi.references, catalogue }); // catalogue from readNamedReferences
if (resolved.blocked) return show(resolved.diagnostics);              // no `nouveaux` creation for a ref the visitor did not confirm
const prep = await prepareReferences(resolved.bindings, { read: path => store.get(path).then(e => e?.blob ?? null), classify: classifyPicture }, cache);
const bound = withPreparedHashes(resolved.bindings, prep);
const compiled = compileReferences(bound, capacityOf(manifest), { usable: prep.usable, identityViews });
if (isBlocked([...prep.diagnostics, ...compiled.diagnostics])) return show(...);
const roles = slotPrompt(compiled, bound, labels, i => `<ref_image_${i}>`);
const snapshot = await shotSnapshot({ scope, plan, revision, planFilmId: envoi.planId, bindings: bound, generation: { …, prompt, orderedAssetIds: compiled.orderedAssetIds, slots: compiled.slots } });
// quote with snapshot.digest; at submit, assertSnapshotCurrent(quote.snapshotDigest, freshSnapshot)
takeGraphFor(settings, prompt, uploadedNames(compiled.orderedAssetIds), seed, controls, roles);
```

The same `prep` and `compiled` feed the quote, the prompt and the graph. Changed pixels change the digest, which voids the quote (`APPROVAL_REQUIRED`).

## Deviations

1. **Over capacity, refuse; never reduce views.**
   - At 2 characters × 2 views + 1 place = 5 pictures for 4 slots, the shot is refused with `REFERENCE_CAPACITY` and the needed and allowed counts.
   - Lowering to 1 view per character is an explicit `identityViews: 1` choice by the visitor. It is never automatic.
2. **Lone character.**
   - It keeps 1 view, as `castReferences` (#217) does.
   - Other roles (place, object, style, framing) send 1 picture each.
3. **`nouveaux` stays in `versPlanFilm`** until CE5 wires the resolver.
   - Today the storyboard still shows « new · will be created » for refs without a card, and the visitor confirms them.
   - The resolver itself never creates an identity.
4. **Extra diagnostic codes, non-blocking:** `REFERENCE_SHARED_ASSET`, `REFERENCE_IMAGES_CAPPED`, `SHEET_ONLY`, `IMAGE_UNREADABLE`, `IMAGE_MISSING`, `IMAGE_CHANGED`.
   - Only `REFERENCE_MISSING`, `REFERENCE_AMBIGUOUS` and `REFERENCE_CAPACITY` block.
   - The UI messages are for CE4.
5. **`ShotSnapshot` has no field for the generation settings.** The digest covers `{ snapshot, generation }`, so the receipt must keep the `GenerationSettings` it was quoted with (CE2) to re-verify.

## Not proven here

The tests prove the inputs (picture → role → entity, counts, digests), not visual quality. Identity fidelity stays with CE5/JD on Cloud.
