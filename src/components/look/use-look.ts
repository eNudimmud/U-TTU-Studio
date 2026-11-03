"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureActiveProject } from "@/lib/coffre/model";
import { projectTitle } from "@/lib/coffre/project";
import { idbVault } from "@/lib/coffre/store";
import { documentVide, type LookDocument, type ProjectLook } from "@/lib/look/model";
import { confirmerLook, lireLookProjet, projetActif } from "@/lib/look/persist";

/** The active project's look. A project with no file stays without one. Opening the page does not create a project. */
export function useProjectLook() {
  const [ready, setReady] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [doc, setDoc] = useState<LookDocument>(documentVide());

  useEffect(() => {
    let gone = false;
    const store = idbVault();
    void (async () => {
      const actif = await projetActif(store).catch(() => null);
      if (gone) return;
      if (actif) {
        const [next, moc] = await Promise.all([
          lireLookProjet(store, actif),
          store.get(`Projets/${actif}/_MOC.md`).then(entry => entry?.text).catch(() => undefined),
        ]);
        if (gone) return;
        setSlug(actif);
        setName(projectTitle(actif, moc));
        setDoc(next);
      }
      if (!gone) setReady(true);
    })();
    return () => { gone = true; };
  }, []);

  const confirm = useCallback(async (next: ProjectLook | null) => {
    const store = idbVault();
    const target = slug ?? await projetActif(store) ?? await ensureActiveProject(store);
    const change = await confirmerLook(store, target, next, new Date().toISOString(), Math.random().toString(36).slice(2, 10));
    setSlug(target);
    setName(current => current || target);
    setDoc(change.document);
    return change.document;
  }, [slug]);

  return { ready, slug, name, doc, confirm };
}
