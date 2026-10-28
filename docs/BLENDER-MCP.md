# Blender cloud via MCP (pas encore construit) / Cloud Blender over MCP (not built)

Sorti du README le 28.10.2026, sans changement de fond. Rien de ce qui suit n’est dans le code.

## Français

La v2 garde le téléphone comme éditeur three.js léger et laisse un agent piloter un Blender headless dans le cloud, pour des scènes plus riches et des passes profondeur/pose exactes :
- **Où tourne Blender :** un conteneur GPU facturé à la seconde (ex. Modal L4) ou un service Blender MCP géré comme Sceneplane (à tester, tarifs non vérifiés).
- **Comment l'agent le pilote :** des outils JSON stricts (`add_actor`, `set_camera_path`, `import_glb`, `render_previs`) traduits en `bpy`. L'addon `mcp-for-blender` exécute du Python arbitraire sur un socket sans authentification : uniquement derrière un réseau privé ou un tunnel SSH, jamais exposé.
- **Ce qui revient :** un GLB que le téléphone rouvre, et une prévis MP4 Eevee/Workbench (profondeur ou pose) envoyée au même workflow « Caméra maîtrisée ».
- **Règles gardées :** devis avant chaque dépense, coût de l'agent plafonné et affiché, Comfy reste le seul moteur du plan final.

## English

Version 2 keeps the phone as a light three.js editor and lets an agent drive a headless Blender in the cloud for richer scenes and exact depth/pose passes:
- **Where Blender runs:** a GPU container billed per second (e.g. Modal L4), or a managed Blender MCP service such as Sceneplane (to be tested, pricing not checked).
- **How the agent drives it:** strict JSON tools (`add_actor`, `set_camera_path`, `import_glb`, `render_previs`) translated to `bpy`. The `mcp-for-blender` addon executes arbitrary Python over an unauthenticated socket: it only ever runs behind a private network or an SSH tunnel, never exposed publicly.
- **What comes back:** a GLB the phone reopens, and an Eevee/Workbench previs MP4 (depth or pose) sent to the same « Directed camera » workflow.
- **Rules kept:** quote before every spend, the language-model agent's cost is capped and shown, Comfy stays the only renderer of the final shot.
- Research behind this plan: the previs-mobile study of 16.10.2026 (not in the repo).
