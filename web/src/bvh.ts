// BVH mocap importer: parses the hierarchy + motion channels, runs forward
// kinematics once, and caches world-space joint positions per frame. The
// 2D coach pose is projected from that cache at sample time, so view-angle
// changes stay live without re-parsing.

export interface BvhJoint {
  name: string;
  offset: [number, number, number];
  channels: string[];
  children: BvhJoint[];
  parent: BvhJoint | null;
  endSite: [number, number, number] | null;
}

export interface BvhClip {
  kind: "bvh";
  name: string;
  duration: number;
  frameTime: number;
  frameCount: number;
  fps: number;
  scale: number;
  jointNames: string[];
  // frameCount * 11 joints * 3 coords, world space (Y up), joint order:
  // hip, neck, head, elbowR, handR, elbowL, handL, kneeR, footR, kneeL, footL
  frames: Float32Array;
}

interface Mat {
  r: number[]; // 3x3 row-major
  t: [number, number, number];
}

type V3 = [number, number, number];

const ident = (): Mat => ({ r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] });

function mul(a: Mat, b: Mat): Mat {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a.r[i * 3] * b.r[j] + a.r[i * 3 + 1] * b.r[3 + j] + a.r[i * 3 + 2] * b.r[6 + j];
    }
  }
  return {
    r,
    t: [
      a.r[0] * b.t[0] + a.r[1] * b.t[1] + a.r[2] * b.t[2] + a.t[0],
      a.r[3] * b.t[0] + a.r[4] * b.t[1] + a.r[5] * b.t[2] + a.t[1],
      a.r[6] * b.t[0] + a.r[7] * b.t[1] + a.r[8] * b.t[2] + a.t[2]
    ]
  };
}

function rot(axis: "X" | "Y" | "Z", deg: number): Mat {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  if (axis === "X") return { r: [1, 0, 0, 0, c, -s, 0, s, c], t: [0, 0, 0] };
  if (axis === "Y") return { r: [c, 0, s, 0, 1, 0, -s, 0, c], t: [0, 0, 0] };
  return { r: [c, -s, 0, s, c, 0, 0, 0, 1], t: [0, 0, 0] };
}

const norm = (name: string) => name.toLowerCase().replace(/^mixamorig/, "").replace(/[^a-z0-9]/g, "");

function parseHierarchy(tokens: string[], start: number): { root: BvhJoint; next: number } {
  let i = start;
  // The caller consumes the ROOT/JOINT keyword; this reads the joint body.
  const parseJoint = (): BvhJoint => {
    const name = tokens[i++];
    const joint: BvhJoint = { name, offset: [0, 0, 0], channels: [], children: [], parent: null, endSite: null };
    if (tokens[i++] !== "{") throw new Error(`BVH: expected { after ${name}`);
    while (i < tokens.length && tokens[i] !== "}") {
      const kw = tokens[i++];
      if (kw === "OFFSET") {
        joint.offset = [Number(tokens[i++]), Number(tokens[i++]), Number(tokens[i++])];
      } else if (kw === "CHANNELS") {
        const n = Number(tokens[i++]);
        joint.channels = tokens.slice(i, i + n);
        i += n;
      } else if (kw === "JOINT") {
        const child = parseJoint();
        child.parent = joint;
        joint.children.push(child);
      } else if (kw === "End") {
        i++; // Site
        if (tokens[i++] !== "{") throw new Error("BVH: malformed End Site");
        i++; // OFFSET
        joint.endSite = [Number(tokens[i++]), Number(tokens[i++]), Number(tokens[i++])];
        if (tokens[i++] !== "}") throw new Error("BVH: malformed End Site close");
      } else {
        throw new Error(`BVH: unexpected token "${kw}" in joint ${name}`);
      }
    }
    i++; // }
    return joint;
  };
  if (tokens[i] !== "ROOT") throw new Error("BVH: hierarchy must start with ROOT");
  i++;
  const root = parseJoint();
  return { root, next: i };
}

function flatten(root: BvhJoint): BvhJoint[] {
  const out: BvhJoint[] = [];
  const walk = (j: BvhJoint) => {
    out.push(j);
    j.children.forEach(walk);
  };
  walk(root);
  return out;
}

function pick(joints: BvhJoint[], test: (n: string) => boolean): BvhJoint | null {
  for (const j of joints) if (test(norm(j.name))) return j;
  return null;
}

const len3 = (v: [number, number, number]) => Math.hypot(v[0], v[1], v[2]);

export function parseBvh(text: string, name = "mocap"): BvhClip {
  const tokens = text.trim().split(/\s+/);
  if (tokens[0] !== "HIERARCHY") throw new Error("BVH: missing HIERARCHY header.");
  const { root, next } = parseHierarchy(tokens, 1);
  let i = next;
  if (tokens[i++] !== "MOTION") throw new Error("BVH: missing MOTION section.");
  if (tokens[i++] !== "Frames:") throw new Error("BVH: missing Frames count.");
  const frameCount = Number(tokens[i++]);
  if (tokens[i++] !== "Frame" || tokens[i++] !== "Time:") throw new Error("BVH: missing Frame Time.");
  const frameTime = Number(tokens[i++]);
  if (!Number.isFinite(frameCount) || frameCount < 2 || !Number.isFinite(frameTime) || frameTime <= 0) {
    throw new Error("BVH: invalid frame count or frame time.");
  }

  const joints = flatten(root);
  const channelCount = joints.reduce((s, j) => s + j.channels.length, 0);
  const data = new Float32Array(frameCount * channelCount);
  for (let k = 0; k < data.length; k++) {
    const v = Number(tokens[i + k]);
    if (!Number.isFinite(v)) throw new Error("BVH: motion data is truncated or malformed.");
    data[k] = v;
  }

  // Role matching across common mocap naming schemes (Mixamo, CMU, generic).
  const right = (n: string) => /^(r|right)/.test(n) && !/^root/.test(n);
  const left = (n: string) => /^(l|left)/.test(n);
  const hipJ = pick(joints, (n) => /^(root|hips?|pelvis)$/.test(n)) ?? root;
  const neckJ = pick(joints, (n) => /neck/.test(n)) ?? pick(joints, (n) => /(chest|spine)/.test(n));
  const headJ = pick(joints, (n) => /head/.test(n));
  const armR = pick(joints, (n) => right(n) && /(arm|shoulder|shldr|humerus)/.test(n) && !/fore|lower|hand|wrist|elbow/.test(n));
  const foreR = pick(joints, (n) => right(n) && /(forearm|lowerarm|elbow|radius)/.test(n));
  const handR = pick(joints, (n) => right(n) && /(hand|wrist)/.test(n));
  const armL = pick(joints, (n) => left(n) && /(arm|shoulder|shldr|humerus)/.test(n) && !/fore|lower|hand|wrist|elbow/.test(n));
  const foreL = pick(joints, (n) => left(n) && /(forearm|lowerarm|elbow|radius)/.test(n));
  const handL = pick(joints, (n) => left(n) && /(hand|wrist)/.test(n));
  const upLegR = pick(joints, (n) => right(n) && /(upleg|upperleg|thigh|femur)/.test(n));
  const shinR = pick(joints, (n) => right(n) && /(leg|knee|shin|tibia|calf)/.test(n) && !/up|upper|thigh|femur/.test(n));
  const footR = pick(joints, (n) => right(n) && /(foot|ankle|toe)/.test(n));
  const upLegL = pick(joints, (n) => left(n) && /(upleg|upperleg|thigh|femur)/.test(n));
  const shinL = pick(joints, (n) => left(n) && /(leg|knee|shin|tibia|calf)/.test(n) && !/up|upper|thigh|femur/.test(n));
  const footL = pick(joints, (n) => left(n) && /(foot|ankle|toe)/.test(n));

  if (!armR && !armL && !upLegR && !upLegL) {
    throw new Error("BVH: no recognizable arm or leg joints — is this a character mocap file?");
  }

  // Bone lengths live on the child joint offsets (knee = thigh bone,
  // ankle = shin bone); the upleg offset is just the hip attachment.
  const thighLen = shinR ? len3(shinR.offset) : upLegR ? len3(upLegR.offset) : 0;
  const shinLen = footR ? len3(footR.offset) : shinR ? len3(shinR.offset) * 0.93 : 0;
  const thighLenL = shinL ? len3(shinL.offset) : upLegL ? len3(upLegL.offset) : 0;
  const shinLenL = footL ? len3(footL.offset) : shinL ? len3(shinL.offset) * 0.93 : 0;
  const legLen = thighLen + shinLen || thighLenL + shinLenL;
  const torsoLen = neckJ ? len3(neckJ.offset) : 0;
  const scale = legLen > 0 ? 58 / legLen : torsoLen > 0 ? 44 / torsoLen : 1;

  const selected = [hipJ, neckJ, headJ, armR, foreR, handR, armL, foreL, handL, upLegR, shinR, footR, upLegL, shinL, footL];
  const indexOf = new Map<BvhJoint, number>();
  joints.forEach((j, idx) => indexOf.set(j, idx));

  const frames = new Float32Array(frameCount * 11 * 3);
  const world: Mat[] = joints.map(() => ident());

  const dir3 = (a: [number, number, number], b: [number, number, number], len: number): [number, number, number] => {
    const d: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return [b[0] + (d[0] / l) * len, b[1] + (d[1] / l) * len, b[2] + (d[2] / l) * len];
  };

  for (let f = 0; f < frameCount; f++) {
    let c = f * channelCount;
    for (let j = 0; j < joints.length; j++) {
      const joint = joints[j];
      let m: Mat = { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [...joint.offset] };
      for (const ch of joint.channels) {
        const v = data[c++];
        if (ch === "Xposition") m.t[0] += v;
        else if (ch === "Yposition") m.t[1] += v;
        else if (ch === "Zposition") m.t[2] += v;
        else if (ch === "Xrotation") m = mul(m, rot("X", v));
        else if (ch === "Yrotation") m = mul(m, rot("Y", v));
        else if (ch === "Zrotation") m = mul(m, rot("Z", v));
      }
      world[j] = joint.parent ? mul(world[indexOf.get(joint.parent)!], m) : m;
    }

    const w = (j: BvhJoint | null): V3 => (j ? [...world[indexOf.get(j)!].t] : [0, 0, 0]);
    const hip = w(hipJ);
    const neck: V3 = neckJ ? w(neckJ) : [hip[0], hip[1] + 44 / scale, hip[2]];
    const head: V3 = headJ ? w(headJ) : [neck[0], neck[1] + 18 / scale, neck[2]];
    const shoulderR = armR ? w(armR) : neck;
    const shoulderL = armL ? w(armL) : neck;
    const elbowR: V3 = foreR ? w(foreR) : handR ? dir3(shoulderR, w(handR), -24 / scale) : [shoulderR[0] + 26 / scale, shoulderR[1], shoulderR[2]];
    const elbowL: V3 = foreL ? w(foreL) : handL ? dir3(shoulderL, w(handL), -24 / scale) : [shoulderL[0] - 26 / scale, shoulderL[1], shoulderL[2]];
    const handRp = handR ? w(handR) : dir3(shoulderR, elbowR, 24 / scale);
    const handLp = handL ? w(handL) : dir3(shoulderL, elbowL, 24 / scale);
    const kneeR: V3 = shinR ? w(shinR) : footR ? dir3(w(upLegR), w(footR), -30 / scale) : [hip[0] + 8 / scale, hip[1] - 30 / scale, hip[2]];
    const kneeL: V3 = shinL ? w(shinL) : footL ? dir3(w(upLegL), w(footL), -30 / scale) : [hip[0] - 8 / scale, hip[1] - 30 / scale, hip[2]];
    const footRp = footR ? w(footR) : dir3(w(upLegR), kneeR, 28 / scale);
    const footLp = footL ? w(footL) : dir3(w(upLegL), kneeL, 28 / scale);

    // slot order: hip, neck, head, elbowR, handR, elbowL, handL, kneeR, footR, kneeL, footL
    const vals = [hip, neck, head, elbowR, handRp, elbowL, handLp, kneeR, footRp, kneeL, footLp];
    for (let s = 0; s < 11; s++) {
      const base = f * 33 + s * 3;
      frames[base] = vals[s][0];
      frames[base + 1] = vals[s][1];
      frames[base + 2] = vals[s][2];
    }
  }

  return {
    kind: "bvh",
    name,
    duration: (frameCount - 1) * frameTime,
    frameTime,
    frameCount,
    fps: Math.round(1 / frameTime),
    scale,
    jointNames: selected.filter(Boolean).map((j) => j!.name),
    frames
  };
}

export interface BvhPose {
  hip: number;
  lean: number;
  aR: [number, number];
  aL: [number, number];
  lR: [number, number];
  lL: [number, number];
  tilt: number;
  fist: number;
}

const ang = (a: [number, number], b: [number, number]) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

// Projects the cached world joints into the coach's 2D space. viewDeg orbits
// the camera around the vertical axis; the root's horizontal travel is
// re-centered so the coach stays on stage.
export function sampleBvh(clip: BvhClip, t: number, viewDeg = 0): BvhPose {
  const ft = clip.frameTime;
  const pos = Math.min(Math.max(t / ft, 0), clip.frameCount - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(i0 + 1, clip.frameCount - 1);
  const u = pos - i0;
  const th = (viewDeg * Math.PI) / 180;
  const cos = Math.cos(th), sin = Math.sin(th);
  const s = clip.scale;

  const j = (slot: number): [number, number] => {
    const b0 = i0 * 33 + slot * 3;
    const b1 = i1 * 33 + slot * 3;
    const x = clip.frames[b0] + (clip.frames[b1] - clip.frames[b0]) * u;
    const y = clip.frames[b0 + 1] + (clip.frames[b1 + 1] - clip.frames[b0 + 1]) * u;
    const z = clip.frames[b0 + 2] + (clip.frames[b1 + 2] - clip.frames[b0 + 2]) * u;
    return [x * cos + z * sin, y];
  };

  const rootX = j(0)[0];
  const rootY0 = clip.frames[1]; // root Y at frame 0
  const pt = (slot: number): [number, number] => {
    const [x, y] = j(slot);
    return [100 + (x - rootX) * s, 150 - (y - rootY0) * s];
  };

  const hip = pt(0), neck = pt(1), head = pt(2);
  const elbowR = pt(3), handR = pt(4), elbowL = pt(5), handL = pt(6);
  const kneeR = pt(7), footR = pt(8), kneeL = pt(9), footL = pt(10);

  return {
    hip: hip[1] - 150,
    lean: ang(hip, neck) + 90,
    aR: [ang(neck, elbowR), ang(elbowR, handR)],
    aL: [ang(neck, elbowL), ang(elbowL, handL)],
    lR: [ang(hip, kneeR), ang(kneeR, footR)],
    lL: [ang(hip, kneeL), ang(kneeL, footL)],
    tilt: ang(neck, head) + 90,
    fist: 1
  };
}