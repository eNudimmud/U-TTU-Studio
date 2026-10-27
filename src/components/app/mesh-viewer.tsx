"use client";

import { useEffect, useRef } from "react";

/**
 * Interactive GLB/GLTF viewer (rotate / zoom, touch-friendly).
 * Uses three.js already in the app — no model-viewer dependency.
 */
export function MeshViewer({ url, label }: { url: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let dead = false;
    let dispose = () => {};

    void Promise.all([
      import("three"),
      import("three/examples/jsm/controls/OrbitControls.js"),
      import("three/examples/jsm/loaders/GLTFLoader.js"),
    ]).then(([THREE, { OrbitControls }, { GLTFLoader }]) => {
      if (dead || !host.current) return;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const canvas = renderer.domElement;
      canvas.className = "u-mesh-canvas";
      canvas.setAttribute("aria-label", label);
      host.current.replaceChildren(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
      camera.position.set(1.6, 1.1, 1.6);
      scene.add(new THREE.HemisphereLight(0xfff4e5, 0x2a241c, 1.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(2, 4, 3);
      scene.add(key);

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 0.4;
      controls.maxDistance = 8;
      controls.target.set(0, 0.4, 0);
      controls.update();

      const fit = (root: THREE.Object3D) => {
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const span = Math.max(size.x, size.y, size.z, 0.01);
        root.position.sub(center);
        root.position.y += size.y / 2;
        camera.position.set(span * 1.4, span * 0.9, span * 1.4);
        controls.target.set(0, size.y * 0.35, 0);
        controls.update();
      };

      void new GLTFLoader().loadAsync(url).then(gltf => {
        if (dead) return;
        scene.add(gltf.scene);
        fit(gltf.scene);
      }).catch(() => { /* keep empty viewer; download still works */ });

      const resize = () => {
        if (!host.current) return;
        const w = Math.max(1, host.current.clientWidth);
        const h = Math.max(1, host.current.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host.current);

      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        controls.update();
        renderer.render(scene, camera);
      };
      tick();

      dispose = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        controls.dispose();
        renderer.dispose();
        scene.traverse(obj => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of mats) mat?.dispose?.();
          }
        });
        host.current?.replaceChildren();
      };
    });

    return () => { dead = true; dispose(); };
  }, [url, label]);

  return <div className="u-mesh-viewer" data-mesh-viewer="" ref={host} role="img" aria-label={label} />;
}
