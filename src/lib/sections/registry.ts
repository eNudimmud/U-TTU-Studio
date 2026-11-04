export const SECTIONS = ["cinema", "anime"] as const;
export type Section = typeof SECTIONS[number];
export const STEPS = ["cast", "set", "shoot", "edit", "finish"] as const;
export type Step = typeof STEPS[number];
export const STEP_COPY: Record<Step, { label: string; title: string; note: string; object: string }> = {
  cast: { label: "Cast", title: "Tout commence par une présence.", note: "Crée tes personnages. Garde leur identité, change leur histoire.", object: "personnages" },
  set: { label: "Set", title: "Donne un lieu à ton histoire.", note: "Un décor, une lumière, une atmosphère. Le monde de ton film prend forme.", object: "décors" },
  shoot: { label: "Shoot", title: "Une intention. Un plan.", note: "Compose ton cadre, tourne tes prises et garde celle qui raconte juste.", object: "prises" },
  edit: { label: "Edit", title: "Trouve le rythme de ton film.", note: "Assemble les prises gardées. Ajuste les coupes, puis exporte ton montage.", object: "montages" },
  finish: { label: "Finish", title: "Le dernier geste.", note: "Améliore la résolution et la netteté de la prise gardée. Son original reste disponible.", object: "prises gardées" },
};
export type ToolId = "text" | "references" | "import" | "animate";
export const CAST_TOOLS: { id: ToolId; title: string; note: string; mark: string }[] = [
  { id: "text", title: "Depuis un texte", note: "Décris un visage, une silhouette, une tenue.", mark: "01" },
  { id: "references", title: "Depuis des références", note: "Retrouve ton personnage à partir de ses images.", mark: "02" },
  { id: "import", title: "Importer une création", note: "Ajoute une image existante à ton projet.", mark: "03" },
];
export const sectionPath = (section: Section, step: Step | "prompts" | "bible") => `/studio/${section}/${step}`;
export const isSection = (value: string): value is Section => (SECTIONS as readonly string[]).includes(value);
export const isStep = (value: string): value is Step => (STEPS as readonly string[]).includes(value);

export const SET_TOOLS = CAST_TOOLS.map(tool => ({ ...tool, note: tool.id === "text" ? "Décris un lieu, son architecture et sa lumière." : tool.id === "references" ? "Pars de tes repérages et de tes images du lieu." : "Ajoute un décor existant à ton projet." }));

export const SHOOT_TOOLS: typeof CAST_TOOLS = [
  {id:"references",title:"Composer le cadre",note:"Place tes personnages dans leur décor.",mark:"01"},
  {id:"animate",title:"Animer une image",note:"Décris le jeu et le mouvement de caméra.",mark:"02"},
  {id:"import",title:"Importer une prise",note:"Ajoute une image ou une vidéo déjà tournée.",mark:"03"},
];
