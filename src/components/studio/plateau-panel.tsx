"use client";

import { useEffect, useRef, useState } from "react";
import { ANGLES } from "@/lib/gate/vocabulary";
import {
  PLATEAU_EMPTY_LINE, PLATEAU_EMPTY_TITLE, PLATEAU_HELP, PLATEAU_NEXT_PREVIZ, PLATEAU_READY_LINE,
} from "@/lib/cinema";
import {
  PLATEAU_EVENT, PLATEAU_FRAME_MAX, PLATEAU_SCENE_MAX, PLATEAU_SEQUENCE_MAX, PLATEAU_STILL_MAX,
  clipPlateauText, createPlateauScene, emptyPlateau, readPlateau, savePlateau, sceneHasPreviz,
  type PlateauBook, type PlateauScene, type PlateauSequence, type PlateauStill,
} from "@/lib/plateau";
import { forgetPlateauFile, rememberPlateauFile } from "@/lib/take-files";
import { useGoToStep } from "./mode-context";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_MAX = 8 * 1024 * 1024;

function fileOk(file: File): boolean {
  return IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= IMAGE_MAX;
}

function baseName(file: File): string {
  const base = file.name.split(/[/\\]/).pop() ?? "image";
  return clipPlateauText(base, 60) || "image";
}

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function PlateauPanel() {
  const goStep = useGoToStep();
  const [book, setBook] = useState<PlateauBook>(emptyPlateau());
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const loaded = readPlateau(window.localStorage);
    setBook(loaded);
    setOpenId(loaded.scenes[0]?.id ?? null);
    setReady(true);
  }, []);

  useEffect(() => () => {
    for (const url of urls.current) URL.revokeObjectURL(url);
  }, []);

  function commit(next: PlateauBook, focusId?: string) {
    if (!ready) return;
    setBook(next);
    if (focusId) setOpenId(focusId);
    savePlateau(window.localStorage, next);
    window.dispatchEvent(new Event(PLATEAU_EVENT));
  }

  function pose() {
    const scene = createPlateauScene(draft, `lieu-${newId()}`);
    if (!scene) return;
    if (book.scenes.length >= PLATEAU_SCENE_MAX) {
      setNotice(`Huit lieux au plus, sur cet appareil.`);
      return;
    }
    commit({ scenes: [...book.scenes, scene] }, scene.id);
    setDraft("");
    setNaming(false);
    setNotice("");
  }

  function patch(id: string, next: PlateauScene) {
    commit({ scenes: book.scenes.map(scene => scene.id === id ? next : scene) });
  }

  function remove(id: string) {
    const scenes = book.scenes.filter(scene => scene.id !== id);
    commit({ scenes }, scenes[0]?.id);
    if (scenes.length === 0) setOpenId(null);
  }

  function remember(id: string, file: File) {
    rememberPlateauFile(id, file);
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    setPreviews(current => ({ ...current, [id]: url }));
  }

  const open = book.scenes.find(scene => scene.id === openId) ?? null;

  return <section className="mode-panel" aria-labelledby="mode-title">
    <header className="mode-hero">
      <h1 id="mode-title" tabIndex={-1}>Pose le <em>monde.</em></h1>
      <p className="mode-lead">Tu le construis à ton bureau, puis tu l’apportes ici. Images, suite d’images, notes d’angles. La prise se tournera dedans.</p>
    </header>

    {book.scenes.length === 0 && !naming && <div className="library-empty plateau-empty">
      <strong>{PLATEAU_EMPTY_TITLE}</strong>
      <p>{PLATEAU_EMPTY_LINE}</p>
      <button type="button" className="button button-primary" onClick={() => setNaming(true)}>Nommer le lieu</button>
    </div>}

    {naming && book.scenes.length === 0 && <form className="take-plan" onSubmit={event => { event.preventDefault(); pose(); }}>
      <label htmlFor="plateau-name">Nom du lieu
        <input id="plateau-name" value={draft} onChange={event => setDraft(event.target.value)} placeholder="quai, nuit, pluie" maxLength={60} autoFocus />
      </label>
      <p>Un nom suffit pour commencer. Les images viennent juste après. Rien n’est envoyé.</p>
      <div className="burn-actions">
        <button type="button" className="button button-outline" onClick={() => { setNaming(false); setDraft(""); }}>Annuler</button>
        <button type="submit" className="button button-primary" disabled={draft.trim().length === 0}>Poser le lieu</button>
      </div>
    </form>}

    {book.scenes.length > 0 && <div className="plateau-layout">
      <div className="plateau-side">
        <ul className="plateau-list" aria-label="Lieux">
          {book.scenes.map(scene => <li key={scene.id}>
            <button type="button" aria-current={scene.id === open?.id ? "true" : undefined} onClick={() => setOpenId(scene.id)}>{scene.name || "Sans nom"}</button>
          </li>)}
        </ul>
        {naming ? <form className="plateau-name" onSubmit={event => { event.preventDefault(); pose(); }}>
          <label htmlFor="plateau-name-more" className="sr-only">Nom du lieu</label>
          <input id="plateau-name-more" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Un autre lieu" maxLength={60} />
          <button type="submit" className="button button-outline" disabled={draft.trim().length === 0}>Poser</button>
        </form> : <button type="button" className="text-button" onClick={() => setNaming(true)}>Nommer un autre lieu</button>}
      </div>
      {open && <SceneWorkspace
        scene={open}
        previews={previews}
        notice={notice}
        onNotice={setNotice}
        onChange={next => patch(open.id, next)}
        onRemove={() => remove(open.id)}
        onPreview={remember}
        onTake={() => goStep("take")}
      />}
    </div>}

    <details className="disclosure create-drawer">
      <summary>D’où vient la préviz ?</summary>
      <p className="expert-note">{PLATEAU_HELP}</p>
    </details>
  </section>;
}

function SceneWorkspace({
  scene, previews, notice, onNotice, onChange, onRemove, onPreview, onTake,
}: {
  scene: PlateauScene;
  previews: Record<string, string>;
  notice: string;
  onNotice: (value: string) => void;
  onChange: (scene: PlateauScene) => void;
  onRemove: () => void;
  onPreview: (id: string, file: File) => void;
  onTake: () => void;
}) {
  const ready = sceneHasPreviz(scene);

  function setAngle(index: 0 | 1 | 2 | 3, value: string) {
    const angles: PlateauScene["angles"] = [scene.angles[0], scene.angles[1], scene.angles[2], scene.angles[3]];
    angles[index] = value;
    onChange({ ...scene, angles });
  }

  function addStills(files: File[]) {
    const images = files.filter(fileOk);
    if (images.length === 0) {
      onNotice("Garde une image JPEG, PNG ou WebP, jusqu’à 8 Mo.");
      return;
    }
    const room = PLATEAU_STILL_MAX - scene.stills.length;
    if (room <= 0) {
      onNotice("Huit images de repère au plus, pour ce lieu.");
      return;
    }
    const stills: PlateauStill[] = images.slice(0, room).map(file => {
      const id = `still-${newId()}`;
      onPreview(id, file);
      return { id, name: baseName(file), note: "" };
    });
    onChange({ ...scene, stills: [...scene.stills, ...stills] });
    onNotice(images.length > room ? "Certaines images restent de côté : huit au plus." : "");
  }

  function addSequence(files: File[]) {
    const images = files.filter(fileOk);
    if (images.length === 0) {
      onNotice("La suite attend des images JPEG, PNG ou WebP, 8 Mo chacune.");
      return;
    }
    if (scene.sequences.length >= PLATEAU_SEQUENCE_MAX) {
      onNotice("Quatre suites au plus, pour ce lieu.");
      return;
    }
    const frames = images.slice(0, PLATEAU_FRAME_MAX);
    const id = `suite-${newId()}`;
    const sequence: PlateauSequence = {
      id,
      name: clipPlateauText(baseName(frames[0]!).replace(/\.[^.]+$/, ""), 60) || "Suite",
      note: "",
      frames: frames.map(baseName),
    };
    onPreview(id, frames[0]!);
    onChange({ ...scene, sequences: [...scene.sequences, sequence] });
    onNotice(images.length > PLATEAU_FRAME_MAX ? `La suite garde ${PLATEAU_FRAME_MAX} noms. Le reste n’est pas noté.` : "");
  }

  return <div className="plateau-work">
    <label htmlFor="plateau-lieu">Nom du lieu
      <input id="plateau-lieu" value={scene.name} maxLength={60} onChange={event => onChange({ ...scene, name: event.target.value })} />
    </label>
    <p className="plateau-hint" role="status">{ready ? PLATEAU_READY_LINE : PLATEAU_NEXT_PREVIZ}</p>
    <label htmlFor="plateau-note">Note du monde
      <textarea id="plateau-note" value={scene.note} maxLength={280} placeholder="Ce qui tient le lieu : heure, climat, ce qui ne bouge pas." onChange={event => onChange({ ...scene, note: event.target.value.slice(0, 280) })} />
    </label>
    <fieldset className="plateau-angles">
      <legend>Angles</legend>
      {ANGLES.map((angle, index) => <label key={angle.id} htmlFor={`plateau-angle-${index}`}>{angle.label}
        <input id={`plateau-angle-${index}`} value={scene.angles[index] ?? ""} maxLength={280} placeholder="Où se pose le regard" onChange={event => setAngle(index as 0 | 1 | 2 | 3, event.target.value)} />
      </label>)}
    </fieldset>

    <div className="plateau-bring">
      <label className="button button-outline file-button">Image de repère
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { addStills([...(event.target.files ?? [])]); event.target.value = ""; }} />
      </label>
      <label className="button button-outline file-button">Suite d’images
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { addSequence([...(event.target.files ?? [])]); event.target.value = ""; }} />
      </label>
    </div>
    <p className="create-fine">L’aperçu reste le temps de la page. Le nom et la note restent sur cet appareil.</p>
    {notice && <p className="create-status is-warn" role="status">{notice}</p>}

    {scene.stills.length > 0 && <ul className="plateau-stills">
      {scene.stills.map(still => <li key={still.id}>
        {previews[still.id] && <img src={previews[still.id]} alt="" />}
        <strong>{still.name}</strong>
        <label htmlFor={`still-note-${still.id}`}>Note
          <input id={`still-note-${still.id}`} value={still.note} maxLength={280} onChange={event => onChange({
            ...scene,
            stills: scene.stills.map(item => item.id === still.id ? { ...item, note: event.target.value } : item),
          })} />
        </label>
        <button type="button" className="text-button" onClick={() => { forgetPlateauFile(still.id); onChange({ ...scene, stills: scene.stills.filter(item => item.id !== still.id) }); }}>Retirer</button>
      </li>)}
    </ul>}

    {scene.sequences.length > 0 && <ul className="plateau-sequences">
      {scene.sequences.map(sequence => <li key={sequence.id}>
        {previews[sequence.id] && <img src={previews[sequence.id]} alt="" />}
        <label htmlFor={`suite-name-${sequence.id}`}>Suite
          <input id={`suite-name-${sequence.id}`} value={sequence.name} maxLength={60} onChange={event => onChange({
            ...scene,
            sequences: scene.sequences.map(item => item.id === sequence.id ? { ...item, name: event.target.value } : item),
          })} />
        </label>
        <p>{sequence.frames.length} image{sequence.frames.length > 1 ? "s" : ""} · {sequence.frames[0]}{sequence.frames.length > 1 ? ` → ${sequence.frames[sequence.frames.length - 1]}` : ""}</p>
        <label htmlFor={`suite-note-${sequence.id}`}>Note
          <input id={`suite-note-${sequence.id}`} value={sequence.note} maxLength={280} placeholder="Caméra, durée, ce que la suite montre" onChange={event => onChange({
            ...scene,
            sequences: scene.sequences.map(item => item.id === sequence.id ? { ...item, note: event.target.value } : item),
          })} />
        </label>
        <button type="button" className="text-button" onClick={() => { forgetPlateauFile(sequence.id); onChange({ ...scene, sequences: scene.sequences.filter(item => item.id !== sequence.id) }); }}>Retirer la suite</button>
      </li>)}
    </ul>}

    <div className="plateau-foot">
      <button type="button" className={`button ${ready ? "button-primary" : "button-outline"}`} disabled={!ready} onClick={onTake}>Voir la prise</button>
      <button type="button" className="text-button" onClick={onRemove}>Retirer ce lieu</button>
    </div>
  </div>;
}
