import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  duplicateAudio, duplicateVideo, emptyEdit, fadeMix, mediaTime, playSpan, setVideoFade, setVideoSpeed, setVideoTitle, videoDuration,
  type AudioClip, type VideoClip,
} from "../src/lib/montage/edit.ts";

function video(id: string, extra: Partial<VideoClip> = {}): VideoClip {
  return { id, kind: "image", source: null, label: id, media: 4, start: 0, end: 4, takeId: null, ...extra };
}

function audio(id: string): AudioClip {
  return { id, track: "voix", source: "a.wav", label: id, media: 3, start: 0, end: 3, at: 0, volume: 1, fadeIn: 0, fadeOut: 0 };
}

describe("actions de montage", () => {
  it("duplicates a shot after itself and a sound after its end", () => {
    const edit = { ...emptyEdit("m", "M"), video: [video("a"), video("b")], audio: [audio("v")] };
    const pictures = duplicateVideo(edit, "a", "a2");
    assert.deepEqual(pictures.video.map(clip => clip.id), ["a", "a2", "b"]);
    assert.equal(pictures.video[1]?.takeId, null);
    assert.equal(duplicateVideo(edit, "a", "a"), edit);
    const sounds = duplicateAudio(edit, "v", "v2");
    assert.equal(sounds.audio[1]?.at, 3);
    assert.equal(sounds.audio[1]?.id, "v2");
  });

  it("shortens the timeline when the speed rises, and stores fade and title", () => {
    const edit = { ...emptyEdit("m", "M"), video: [video("a")], audio: [] };
    const fast = setVideoSpeed(edit, "a", 2);
    assert.equal(fast.video[0]?.end, 4);
    assert.equal(playSpan(fast.video[0]!), 2);
    assert.equal(videoDuration(fast), 2);
    assert.equal(mediaTime(fast.video[0]!, 1), 2);
    assert.equal(mediaTime(fast.video[0]!, 10), 4);
    assert.equal(setVideoSpeed(edit, "a", 0).video[0]?.speed, 0.25);
    const faded = setVideoFade(fast, "a", 0.5);
    assert.equal(faded.video[0]?.fadeOut, 0.5);
    const titled = setVideoTitle(faded, "a", "  Nuit  ");
    assert.equal(titled.video[0]?.title, "Nuit");
  });

  it("mixes into the next shot only inside the fade window", () => {
    const edit = {
      ...emptyEdit("m", "M"),
      video: [video("a", { fadeOut: 1 }), video("b")],
      audio: [],
    };
    assert.equal(fadeMix(edit, 2), null);
    assert.deepEqual(fadeMix(edit, 3.5), { index: 0, mix: 0.5 });
    assert.equal(fadeMix({ ...edit, video: [video("a", { fadeOut: 1 })] }, 3.5), null);
  });
});