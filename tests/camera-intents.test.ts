import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cameraPlan, composeScene, readPhrase } from '../src/lib/maquette/phrase-scene.ts';
import { initialMaquette, RADIUS_MAX, RADIUS_MIN } from '../src/lib/maquette/state.ts';
import { PATH_SECONDS } from '../src/lib/maquette/scene.ts';

const FROM = { theta: 0, phi: 1.1, radius: 6 };
const span = (path: { orbit: { radius: number } }[]) => Math.round((path.at(-1)!.orbit.radius - path[0].orbit.radius) * 10) / 10;

describe('camera intents', () => {
  it('reads a travelling with its distance in four languages', () => {
    for (const [phrase, move] of [
      ['travelling arrière de 5 m', 'arriere'], ['dolly out 5 meters', 'arriere'], ['Rückfahrt 5 m', 'arriere'], ['travelling hacia atrás de 5 metros', 'arriere'],
      ['travelling avant de 4 mètres', 'avant'], ['push in 4 m', 'avant'], ['Fahrt näher 4 Meter', 'avant'], ['acercamiento de 4 metros', 'avant'],
    ] as const) {
      const reading = readPhrase(phrase);
      assert.equal(reading.move, move, phrase);
      const plan = cameraPlan(reading, FROM);
      assert.equal(Math.abs(span(plan.path)), reading.meters, phrase);
      assert.equal(plan.clamped, false, phrase);
      assert.equal(plan.path.at(-1)!.t, PATH_SECONDS);
      assert.ok(move === 'arriere' ? span(plan.path) > 0 : span(plan.path) < 0, phrase);
    }
  });

  it('clamps a travelling longer than the maquette and says so', () => {
    const plan = cameraPlan(readPhrase('travelling arrière de 40 m'), FROM);
    assert.equal(plan.clamped, true);
    for (const key of plan.path) assert.ok(key.orbit.radius >= RADIUS_MIN && key.orbit.radius <= RADIUS_MAX);
  });

  it('orbits by the asked angle and direction', () => {
    for (const phrase of ['la caméra tourne autour de 90° vers la gauche', 'orbit 90 degrees to the left', 'Kamera umkreist sie um 90 Grad nach links', 'la cámara gira alrededor 90 grados a la izquierda']) {
      const reading = readPhrase(phrase);
      assert.equal(reading.move, 'tour', phrase);
      assert.equal(reading.degrees, 90, phrase);
      assert.equal(reading.side, -1, phrase);
      const plan = cameraPlan(reading, FROM);
      assert.ok(Math.abs(plan.path.at(-1)!.orbit.theta + Math.PI / 2) < 1e-9, phrase);
    }
    assert.equal(cameraPlan(readPhrase('tour complet autour'), FROM).path.length, 5);
  });

  it('tells a low angle from a high angle', () => {
    for (const phrase of ['contre-plongée sur Uttu', 'low angle shot', 'Froschperspektive', 'contrapicado']) assert.equal(readPhrase(phrase).move, 'contre', phrase);
    for (const phrase of ['plongée sur la rue', 'high angle', 'von oben', 'picado']) assert.equal(readPhrase(phrase).move, 'plongee', phrase);
    const low = cameraPlan(readPhrase('contre-plongée'), FROM).path;
    const high = cameraPlan(readPhrase('plongée'), FROM).path;
    assert.ok(low[0].orbit.phi > high[0].orbit.phi);
  });

  it('pans left or right', () => {
    for (const phrase of ['panoramique vers la droite', 'pan right', 'Schwenk nach rechts', 'paneo a la derecha']) {
      const plan = cameraPlan(readPhrase(phrase), FROM);
      assert.ok(plan.path.at(-1)!.orbit.theta > plan.path[0].orbit.theta, phrase);
    }
    const left = cameraPlan(readPhrase('panoramique gauche'), FROM);
    assert.ok(left.path.at(-1)!.orbit.theta < left.path[0].orbit.theta);
  });

  it('writes the path into the maquette in one undo step', () => {
    const { state, camera } = composeScene(initialMaquette(), 'deux personnages, travelling arrière de 5 m');
    assert.equal(state.figures.length, 2);
    assert.deepEqual(state.path, camera.path);
    assert.deepEqual(state.orbit, camera.path[0].orbit);
  });
});
