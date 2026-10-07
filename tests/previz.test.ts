import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { loadStudio, parseScene, sceneMarkdown, writeText } from "../src/lib/coffre/model.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";
import { referencePaths } from "../src/lib/render/references.ts";
import { PLACE_BLEND_B64 } from "../src/lib/render/place-template.ts";
import { blenderPath, blenderPose, buildPlaceBlend, defaultCamera, moveCamera, placeVolumes } from "../src/lib/render/previz.ts";

const floatBits = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, true);
  return bytes;
};

const includes = (file: Uint8Array, value: number) => {
  const needle = floatBits(value);
  for (let index = 0; index <= file.length - 4; index++) {
    if (needle.every((byte, offset) => file[index + offset] === byte)) return true;
  }
  return false;
};

describe("lieu filmé", () => {
  it("writes a Blender 4.1.1 file of the place and the camera, not a painted frame", () => {
    const camera = defaultCamera("piece");
    const piece = buildPlaceBlend("piece", camera);
    const quai = buildPlaceBlend("quai", { ...defaultCamera("quai"), lens: 85 });
    assert.equal(new TextDecoder().decode(piece.subarray(0, 12)), "BLENDER-v401");
    assert.equal(placeVolumes("piece"), 5);
    assert.equal(placeVolumes("quai"), 4);
    assert.notEqual(piece[0], 0xff, "a blend file is not a JPEG");
    assert.equal(includes(piece, 41.125), false, "the template lens sentinel is overwritten");
    assert.equal(includes(piece, 110.125), false, "the template volume sentinel is overwritten");
    assert.equal(includes(piece, 35), true);
    assert.equal(includes(quai, 85), true);
    assert.notDeepEqual(piece, quai);
    const served = readFileSync("public/studio/place.blend");
    const binary = Buffer.from(PLACE_BLEND_B64, "base64");
    assert.equal(served.equals(binary), true);
  });

  it("keeps the camera on the place, and reopening does not require the blend file", async () => {
    const camera = moveCamera(defaultCamera("quai"), "end", "stand", "x", 1);
    const source = sceneMarkdown({
      id: "le-quai", name: "Le quai", note: "pluie fine", stills: [], previz: "quai", previzFile: "scenes/le-quai.blend", camera, frames: [], render: null, shot: null, views: [],
    });
    assert.deepEqual(parseScene("le-quai", source).camera, camera);
    assert.equal(parseScene("le-quai", source).previz, "quai");
    const store = memoryVault();
    await writeText(store, "scenes/le-quai.md", source);
    const studio = await loadStudio(store);
    assert.equal(studio.scenes[0]?.previz, "quai");
    assert.deepEqual(studio.scenes[0]?.camera, camera);
    assert.equal(studio.scenes[0]?.previzFile, null, "the plan stays when the file is gone");
  });

  it("gives La prise the filmed still after the place photos", () => {
    assert.deepEqual(referencePaths(["refs/a.jpg"], { stills: ["scenes/q.jpg"], render: "scenes/q-rendu.png" }), ["refs/a.jpg", "scenes/q.jpg", "scenes/q-rendu.png"]);
    assert.deepEqual(referencePaths([], { stills: ["scenes/q.jpg"], render: "scenes/q-rendu.png" }), ["scenes/q.jpg", "scenes/q-rendu.png"]);
  });

  const blender = process.env.BLENDER_BIN ?? "/tmp/blender";
  it("opens in Blender 4.1.1 and Cycles renders that camera", { skip: !existsSync(blender) && "blender absent" }, () => {
    const camera = defaultCamera("piece");
    const pose = blenderPose("piece", camera);
    const path = blenderPath("piece", camera);
    const mid = path.start.location.map((value, index) => (value + path.end.location[index]) / 2);
    const file = join(tmpdir(), "uttu-piece-check.blend");
    const png = join(tmpdir(), "uttu-piece-proof");
    writeFileSync(file, buildPlaceBlend("piece", camera));
    const script = `
import bpy, mathutils
bpy.ops.wm.open_mainfile(filepath=${JSON.stringify(file)})
scene = bpy.context.scene
cam = scene.camera
aim = mathutils.Vector(${JSON.stringify([camera.aimX, camera.aimZ, camera.aimY])})
direction = (aim - cam.location).normalized()
forward = cam.matrix_world.to_quaternion() @ mathutils.Vector((0.0, 0.0, -1.0))
print("DOT", forward.dot(direction))
def loc():
    return (round(cam.location.x, 5), round(cam.location.y, 5), round(cam.location.z, 5))
scene.frame_set(1)
print("START", *loc())
scene.frame_set(5)
print("END", *loc())
scene.frame_set(3)
print("MID", *loc())
scene.frame_set(1)
print("LENS", cam.data.lens)
print("ENGINE", scene.render.engine)
print("RES", scene.render.resolution_x, scene.render.resolution_y)
print("FRAMES", scene.frame_start, scene.frame_end)
for index in range(5):
    ob = bpy.data.objects[f"Vol{index}"]
    print("VOL", index, round(ob.location.x, 5), round(ob.location.y, 5), round(ob.location.z, 5), round(ob.scale.x, 5), round(ob.scale.y, 5), round(ob.scale.z, 5))
scene.cycles.device = "CPU"
scene.cycles.samples = 1
scene.cycles.use_denoising = False
scene.render.resolution_percentage = 8
scene.render.filepath = ${JSON.stringify(png)}
bpy.ops.render.render(write_still=True)
print("PNG", scene.render.filepath + ".png")
`;
    const run = spawnSync(blender, ["--background", "--python-expr", script], { encoding: "utf8", timeout: 120000 });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const dot = Number(/DOT (\S+)/.exec(run.stdout)?.[1]);
    assert.ok(dot > 0.98, run.stdout);
    assert.match(run.stdout, /ENGINE CYCLES/);
    assert.match(run.stdout, /RES 768 1024/);
    assert.match(run.stdout, /FRAMES 1 5/);
    assert.match(run.stdout, /LENS 35/);
    const start = /START (\S+) (\S+) (\S+)/.exec(run.stdout);
    const end = /END (\S+) (\S+) (\S+)/.exec(run.stdout);
    const middle = /MID (\S+) (\S+) (\S+)/.exec(run.stdout);
    path.start.location.forEach((value, index) => assert.ok(Math.abs(Number(start?.[index + 1]) - value) < 1e-3, run.stdout));
    path.end.location.forEach((value, index) => assert.ok(Math.abs(Number(end?.[index + 1]) - value) < 1e-3, run.stdout));
    mid.forEach((value, index) => assert.ok(Math.abs(Number(middle?.[index + 1]) - value) < 1e-3, run.stdout));
    assert.notDeepEqual(path.start.location, path.end.location);
    const vol = /VOL 0 (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/.exec(run.stdout);
    [...pose.volumes[0].location, ...pose.volumes[0].scale].forEach((value, index) => assert.ok(Math.abs(Number(vol?.[index + 1]) - value) < 1e-4, run.stdout));
    const written = readFileSync(`${png}.png`);
    assert.equal(written.subarray(0, 4).toString("latin1"), "\x89PNG");
  });
});
