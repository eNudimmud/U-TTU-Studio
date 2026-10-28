import type * as Three from "three";
import { contourCanvas, png, type FramingCapture } from "./framing";

/** Render the actual scene with the same camera, then restore every preview setting. */
export async function captureScene(THREE: typeof Three, renderer: Three.WebGLRenderer, scene: Three.Scene, camera: Three.PerspectiveCamera, width: number, height: number): Promise<FramingCapture> {
  const size = renderer.getSize(new THREE.Vector2());
  const ratio = renderer.getPixelRatio();
  const aspect = camera.aspect;
  const background = scene.background;
  const fog = scene.fog;
  const override = scene.overrideMaterial;
  const clear = renderer.getClearColor(new THREE.Color());
  const alpha = renderer.getClearAlpha();
  const hidden: Three.Object3D[] = [];
  const depthMaterial = new THREE.ShaderMaterial({
    uniforms: { near: { value: camera.near }, far: { value: camera.far } },
    vertexShader: "varying float distanceToCamera; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); distanceToCamera=-p.z; gl_Position=projectionMatrix*p;}",
    fragmentShader: "uniform float near; uniform float far; varying float distanceToCamera; void main(){float d=1.0-clamp((distanceToCamera-near)/(far-near),0.0,1.0); gl_FragColor=vec4(vec3(d),1.0);}",
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const copy = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
    return canvas;
  };
  try {
    scene.traverse(child => {
      if (child.visible && (child instanceof THREE.Sprite || child instanceof THREE.GridHelper || child.userData.exportDecoration)) { hidden.push(child); child.visible = false; }
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setClearColor(0x14110c, 1);
    renderer.render(scene, camera);
    const color = copy();
    scene.background = new THREE.Color(0x000000);
    scene.fog = null;
    scene.overrideMaterial = depthMaterial;
    renderer.setClearColor(0x000000, 1);
    renderer.render(scene, camera);
    const depth = copy();
    const [colorPng, depthPng, edges] = await Promise.all([png(color), png(depth), png(contourCanvas(depth))]);
    return { source: "3d", color: colorPng, depth: depthPng, edges, width, height, camera: { fov: camera.fov, near: camera.near, far: camera.far, world: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray() } };
  } finally {
    scene.overrideMaterial = override; scene.background = background; scene.fog = fog;
    hidden.forEach(child => { child.visible = true; });
    depthMaterial.dispose();
    renderer.setClearColor(clear, alpha);
    renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
}
