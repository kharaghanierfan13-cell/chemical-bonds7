// generator.mjs — Generates the COMPLETE Remotion project in one run: node generator.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const files = {};

/* ---------------- package.json ---------------- */
files["package.json"] = JSON.stringify({
  name: "chemical-bonds-doc",
  version: "1.0.0",
  private: true,
  scripts: {
    sfx: "node scripts/generate-sfx.mjs",
    start: "remotion studio",
    render: "remotion render ChemicalBonds out/chemical-bonds-1080p.mp4",
    render4k: "remotion render ChemicalBonds out/chemical-bonds-4k.mp4 --scale=2"
  },
  engines: { node: ">=18" },
  dependencies: {
    "@remotion/cli": "^4.0.0",
    "@remotion/google-fonts": "^4.0.0",
    "@remotion/noise": "^4.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "^4.0.0"
  },
  devDependencies: { "@types/react": "^18.3.3", "typescript": "^5.6.0" }
}, null, 2);

/* ---------------- tsconfig.json ---------------- */
files["tsconfig.json"] = JSON.stringify({
  compilerOptions: {
    target: "ES2020",
    lib: ["DOM", "ES2020"],
    jsx: "react-jsx",
    module: "ESNext",
    moduleResolution: "Bundler",
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    noEmit: true,
    forceConsistentCasingInFileNames: true
  }
}, null, 2);

/* ---------------- .gitignore / config / README ---------------- */
files[".gitignore"] = "node_modules\nout\n";
files["remotion.config.ts"] = `import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
`;

files["README.md"] = `# مستند «پیوندهای شیمیایی» — AMIR ERFAN KHARAGHANI

پروژه Remotion — 7 صحنه — 154 ثانیه — MP4 H.264 — 1080p و 4K

## اجرا
1. npm install
2. npm run sfx      (تولید ۱۲ افکت صوتی)
3. npm start        (پیش‌نمایش)

## رندر
- npm run render    => 1080p
- npm run render4k  => 4K با --scale=2

## جای نریشن فارسی
در src/ChemicalBonds.tsx کامنت آماده است؛ فایل را در public/ بگذارید.
`;

/* ---------------- scripts/generate-sfx.mjs ---------------- */
files["scripts/generate-sfx.mjs"] = `// Procedural SFX generator — pure Node.js, no dependencies.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sfx");
mkdirSync(OUT, { recursive: true });

const D = (s) => Math.round(SR * s);

function sine(dur, f0, o = {}) {
  const { f1 = f0, gain = 1, attack = 0.01, curve = 4, vib = 0, vibHz = 5, release = 0.05 } = o;
  const n = D(dur), out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, p = t / dur;
    const f = f0 * Math.pow(f1 / f0, p);
    ph += (2 * Math.PI * f) / SR;
    if (vib) ph += Math.sin(2 * Math.PI * vibHz * t) * vib;
    let env = Math.min(1, t / attack) * Math.pow(1 - p, curve);
    if (release < dur) env *= Math.min(1, Math.max(0, (dur - t) / release));
    out[i] = Math.sin(ph) * env * gain;
  }
  return out;
}

function noise(dur, o = {}) {
  const { gain = 1, attack = 0.01, curve = 2, bell = false } = o;
  const n = D(dur), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, p = t / dur;
    const env = bell ? Math.pow(Math.sin(Math.PI * p), 2) : Math.min(1, t / attack) * Math.pow(1 - p, curve);
    out[i] = (Math.random() * 2 - 1) * env * gain;
  }
  return out;
}

function lowpass(x, cutoff) {
  const out = new Float32Array(x.length); let y = 0;
  for (let i = 0; i < x.length; i++) {
    const fc = typeof cutoff === "function" ? cutoff(i / x.length) : cutoff;
    const a = 1 - Math.exp(-(2 * Math.PI * fc) / SR);
    y += a * (x[i] - y); out[i] = y;
  }
  return out;
}

function highpass(x, cutoff) {
  const lp = lowpass(x, cutoff);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] - lp[i];
  return out;
}

function mix(...arrs) {
  const n = Math.max(...arrs.map((a) => a.length));
  const out = new Float32Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
}

function delay(arr, sec) {
  const off = D(sec);
  const out = new Float32Array(arr.length + off);
  out.set(arr, off);
  return out;
}

function normalize(x, peak = 0.85) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? peak / m : 1;
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * g;
  return out;
}

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

function pad(dur, freqs, opts = {}) {
  const { attack = 3, release = 5 } = opts;
  const n = D(dur), out = new Float32Array(n);
  freqs.forEach((f, idx) => {
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const lfo = 0.72 + 0.28 * Math.sin(2 * Math.PI * (0.06 + idx * 0.017) * t + idx * 1.3);
      const env = Math.min(1, t / attack) * Math.min(1, Math.max(0, (dur - t) / release));
      out[i] += Math.sin(2 * Math.PI * f * t + idx) * 0.15 * lfo * env;
    }
  });
  return out;
}

const S = {};

S.boom = normalize(mix(
  sine(2.6, 60, { f1: 26, attack: 0.004, curve: 5, release: 0.6 }),
  lowpass(noise(2.6, { gain: 0.5, attack: 0.002, curve: 6 }), 140)
));

S.pad = normalize(pad(20, [55, 110, 130.81, 164.81, 196], { attack: 3, release: 5 }), 0.5);

S.padResolve = normalize(pad(12, [55, 110, 164.81, 220, 277.18], { attack: 2.2, release: 3.5 }), 0.55);

const wNoise = noise(1.3, { gain: 1, bell: true });
S.whoosh = normalize(lowpass(wNoise, (p) => 500 + 3800 * Math.sin(Math.PI * p)));

S.pulse = normalize(mix(
  sine(0.9, 80, { f1: 64, attack: 0.004, curve: 6 }),
  lowpass(noise(0.05, { gain: 0.5, curve: 3 }), 900)
));

S.blip = normalize(sine(0.25, 900, { f1: 1400, attack: 0.006, curve: 5 }));

S.chime = normalize(mix(
  sine(1.8, 659.25, { attack: 0.008, curve: 3.2, gain: 0.75 }),
  delay(sine(1.6, 987.77, { curve: 3.5, gain: 0.45 }), 0.06)
));

S.sweep = normalize(mix(
  sine(2.0, 280, { f1: 1150, attack: 0.3, curve: 1.6, release: 0.4, vib: 10, vibHz: 6 }),
  highpass(noise(2.0, { gain: 0.12, attack: 0.3, curve: 1.5 }), 3000)
));

S.impact = normalize(mix(
  sine(1.1, 58, { f1: 40, attack: 0.003, curve: 5, release: 0.2 }),
  delay(lowpass(noise(0.06, { gain: 0.6, curve: 4 }), 350)),
  sine(1.1, 220, { curve: 7, gain: 0.22 })
));

S.rise = normalize(mix(
  sine(2.4, 180, { f1: 760, gain: 0.9, attack: 1.1, curve: 1.4, release: 0.6 }),
  sine(2.4, 360, { f1: 1520, gain: 0.3, attack: 1.3, curve: 1.6, release: 0.6 }),
  delay(sine(2.4, 1400, { gain: 0.18, attack: 1.8, curve: 2, release: 0.4 }), 0.15)
));

S.shimmer = normalize(mix(
  ...[1174.7, 1318.5, 1568, 2093, 2349.3].map((f, i) =>
    sine(3.0, f, { gain: 0.14, attack: 1.2, curve: 1.1, release: 1.0, vib: 5, vibHz: 0.3 + i * 0.07 })
  )
));

S.tick = normalize(mix(
  sine(0.1, 1900, { attack: 0.002, curve: 7, gain: 0.8 }),
  delay(lowpass(noise(0.02, { gain: 0.4, curve: 2 }), 2500))
));

for (const [name, data] of Object.entries(S)) {
  writeFileSync(join(OUT, name + ".wav"), wav(data));
  console.log("OK " + name + ".wav");
}
console.log("Done -> " + OUT);
`;

/* ---------------- src/index.ts ---------------- */
files["src/index.ts"] = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

/* ---------------- src/Root.tsx ---------------- */
files["src/Root.tsx"] = `import React from "react";
import { Composition } from "remotion";
import { ChemicalBonds } from "./ChemicalBonds";
import { DURATION, FPS } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ChemicalBonds"
    component={ChemicalBonds}
    durationInFrames={DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
`;

/* ---------------- src/theme.ts ---------------- */
files["src/theme.ts"] = `export const C = {
  ink: "#0D0D0F",
  navy: "#0B1E3A",
  navyLight: "#102A4E",
  panel: "#12305B",
  cyan: "#22D3EE",
  orange: "#FF6B35",
  yellow: "#FFC53D",
  white: "#FFFFFF",
};

export const FPS = 30;
export const DURATION = 4620; // 154s — 7 parts

export type SfxName =
  | "boom" | "pad" | "whoosh" | "pulse" | "blip" | "chime"
  | "sweep" | "impact" | "rise" | "shimmer" | "tick" | "padResolve";

export const SFX_DUR: Record<SfxName, number> = {
  boom: 2.6, pad: 20, whoosh: 1.3, pulse: 0.9, blip: 0.25,
  chime: 1.8, sweep: 2.0, impact: 1.1, rise: 2.4, shimmer: 3.0,
  tick: 0.1, padResolve: 12,
};

export type Cue = { file: SfxName; frame: number; volume: number };

export const AUDIO: Cue[] = [
  { file: "boom", frame: 0, volume: 0.9 },
  { file: "pad", frame: 0, volume: 0.55 },
  { file: "whoosh", frame: 145, volume: 0.55 },
  { file: "whoosh", frame: 255, volume: 0.5 },
  { file: "whoosh", frame: 358, volume: 0.55 },
  { file: "blip", frame: 265, volume: 0.5 },
  { file: "blip", frame: 355, volume: 0.55 },
  { file: "blip", frame: 445, volume: 0.6 },
  { file: "pulse", frame: 483, volume: 0.7 },
  { file: "whoosh", frame: 565, volume: 0.7 },

  { file: "pulse", frame: 600, volume: 0.7 },
  { file: "blip", frame: 730, volume: 0.45 },
  { file: "blip", frame: 790, volume: 0.5 },
  { file: "blip", frame: 850, volume: 0.55 },
  { file: "tick", frame: 985, volume: 0.3 },
  { file: "tick", frame: 1015, volume: 0.3 },
  { file: "tick", frame: 1045, volume: 0.3 },
  { file: "tick", frame: 1075, volume: 0.3 },
  { file: "sweep", frame: 1215, volume: 0.45 },
  { file: "whoosh", frame: 1350, volume: 0.7 },

  { file: "pulse", frame: 1380, volume: 0.85 },
  { file: "blip", frame: 1510, volume: 0.5 },
  { file: "blip", frame: 1555, volume: 0.5 },
  { file: "blip", frame: 1600, volume: 0.5 },
  { file: "blip", frame: 1690, volume: 0.5 },
  { file: "blip", frame: 1735, volume: 0.5 },
  { file: "blip", frame: 1780, volume: 0.5 },
  { file: "sweep", frame: 1860, volume: 0.65 },
  { file: "chime", frame: 1950, volume: 0.6 },
  { file: "tick", frame: 1975, volume: 0.3 },
  { file: "tick", frame: 1990, volume: 0.3 },
  { file: "shimmer", frame: 2005, volume: 0.4 },
  { file: "impact", frame: 2040, volume: 0.9 },
  { file: "impact", frame: 2075, volume: 0.5 },
  { file: "rise", frame: 2220, volume: 0.6 },
  { file: "whoosh", frame: 2310, volume: 0.7 },

  { file: "pulse", frame: 2340, volume: 0.8 },
  { file: "blip", frame: 2460, volume: 0.5 },
  { file: "blip", frame: 2490, volume: 0.5 },
  { file: "chime", frame: 2700, volume: 0.5 },
  { file: "chime", frame: 2880, volume: 0.55 },
  { file: "shimmer", frame: 2940, volume: 0.5 },
  { file: "whoosh", frame: 3150, volume: 0.7 },

  { file: "pulse", frame: 3180, volume: 0.7 },
  { file: "tick", frame: 3300, volume: 0.35 },
  { file: "tick", frame: 3360, volume: 0.35 },
  { file: "tick", frame: 3420, volume: 0.35 },
  { file: "tick", frame: 3480, volume: 0.35 },
  { file: "tick", frame: 3330, volume: 0.3 },
  { file: "tick", frame: 3390, volume: 0.3 },
  { file: "tick", frame: 3450, volume: 0.3 },
  { file: "tick", frame: 3510, volume: 0.3 },
  { file: "pulse", frame: 3720, volume: 0.6 },
  { file: "whoosh", frame: 3810, volume: 0.7 },

  { file: "pad", frame: 3840, volume: 0.22 },
  { file: "rise", frame: 3840, volume: 0.5 },
  { file: "shimmer", frame: 3990, volume: 0.45 },
  { file: "pulse", frame: 4080, volume: 0.6 },
  { file: "shimmer", frame: 4120, volume: 0.4 },

  { file: "padResolve", frame: 4260, volume: 0.6 },
  { file: "tick", frame: 4290, volume: 0.25 },
  { file: "tick", frame: 4320, volume: 0.25 },
  { file: "tick", frame: 4350, volume: 0.25 },
  { file: "tick", frame: 4380, volume: 0.25 },
  { file: "tick", frame: 4410, volume: 0.25 },
  { file: "tick", frame: 4440, volume: 0.25 },
  { file: "tick", frame: 4470, volume: 0.25 },
  { file: "shimmer", frame: 4560, volume: 0.35 },
];
`;

/* ---------------- src/fonts.ts ---------------- */
files["src/fonts.ts"] = `import { loadFont as loadVazirmatn } from "@remotion/google-fonts/Vazirmatn";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";

const vazir = loadVazirmatn();
const space = loadSpaceGrotesk();

export const FA = vazir.fontFamily;
export const EN = space.fontFamily;
`;

/* ---------------- src/components/Atom.tsx ---------------- */
files["src/components/Atom.tsx"] = `import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";

export type ShellSpec = { electrons: number; radius: number; speed?: number };

export const degToRad = (d: number) => (d * Math.PI) / 180;

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function arcPath(r: number, a0: number, a1: number) {
  const x0 = r * Math.cos(degToRad(a0)), y0 = r * Math.sin(degToRad(a0));
  const x1 = r * Math.cos(degToRad(a1)), y1 = r * Math.sin(degToRad(a1));
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return "M " + x0 + " " + y0 + " A " + r + " " + r + " 0 " + large + " " + sweep + " " + x1 + " " + y1;
}

export const Atom: React.FC<{
  uid: string;
  protons: number;
  neutrons: number;
  shells: ShellSpec[];
  build?: number;
  valenceGlow?: boolean;
  gapAt?: number;
  flicker?: number;
  scaleRadius?: number;
  electronColor?: string;
  nucleusColor?: string;
  size?: number;
  opacity?: number;
}> = ({
  uid, protons, neutrons, shells, build = 1, valenceGlow = false,
  gapAt, flicker = 0, scaleRadius = 1, electronColor = C.cyan,
  nucleusColor = C.orange, size = 1, opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const total = shells.reduce((a, s) => a + s.electrons, 0);
  const nucR = (22 + Math.sqrt(protons + neutrons) * 2.1) * size;
  const seg = (f0: number, f1: number, o0 = 0, o1 = 1, easing?: (t: number) => number) =>
    interpolate(build, [f0, f1], [o0, o1], { ...cl, easing });

  const nucP = seg(0, 0.22, 0, 1, Easing.out(Easing.back(1.6)));

  const R = Math.max(...shells.map((s) => s.radius * scaleRadius), 130) * size + 80;
  const S = R * 2;

  const N = protons + neutrons;
  const nucleons = [];
  for (let i = 0; i < N; i++) {
    const a = i * 137.508;
    const rr = nucR * 0.62 * Math.sqrt((i + 0.5) / N);
    nucleons.push(
      <circle
        key={"n" + i}
        cx={rr * Math.cos(degToRad(a))}
        cy={rr * Math.sin(degToRad(a))}
        r={5.2 * size}
        fill={i < protons ? C.orange : "#8FA3BF"}
        opacity={0.95}
      />
    );
  }

  const electrons: React.ReactNode[] = [];
  let gi = 0;
  shells.forEach((s, i) => {
    const rEff = s.radius * scaleRadius * size;
    for (let j = 0; j < s.electrons; j++) {
      const ap = 0.5 + 0.5 * (gi / Math.max(1, total));
      const e = seg(ap - 0.05, ap, 0, 1, Easing.out(Easing.back(1.5)));
      const ang = frame * (s.speed ?? Math.max(8, 26 - i * 6)) + j * (360 / s.electrons) + i * 53;
      const x = rEff * Math.cos(degToRad(ang));
      const y = rEff * Math.sin(degToRad(ang));
      const isValence = i === shells.length - 1;
      const fl = isValence && flicker > 0
        ? 1 - flicker * (0.22 + 0.22 * Math.sin(frame * 0.45 + j * 1.7))
        : 1;
      electrons.push(
        <g key={"e" + gi} opacity={e * fl}>
          <circle cx={x} cy={y} r={15 * size} fill={electronColor} opacity={0.16} />
          <circle cx={x} cy={y} r={6.5 * size} fill={electronColor} />
        </g>
      );
      gi++;
    }
  });

  return (
    <div style={{ position: "absolute", opacity }}>
      <svg
        width={S}
        height={S}
        viewBox={-R + " " + -R + " " + S + " " + S}
        style={{ position: "absolute", left: -R, top: -R, overflow: "visible" }}
      >
        <defs>
          <radialGradient id={"nuc-" + uid} cx="35%" cy="35%">
            <stop offset="0%" stopColor="#FFA25E" />
            <stop offset="60%" stopColor={nucleusColor} />
            <stop offset="100%" stopColor="#C24E1D" />
          </radialGradient>
        </defs>

        {shells.map((s, i) => {
          const rEff = s.radius * scaleRadius * size;
          const pStart = 0.14 + i * 0.16;
          const rev = seg(pStart, pStart + 0.14, 0, 1, Easing.out(Easing.cubic));
          const ccc = 2 * Math.PI * rEff;
          const isVal = i === shells.length - 1;
          return (
            <g key={"r" + i}>
              <circle
                r={rEff} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1.5}
                strokeDasharray={ccc} strokeDashoffset={ccc * (1 - rev)} transform="rotate(-90)"
              />
              {isVal && valenceGlow && (
                <g opacity={rev}>
                  <circle r={rEff} fill="none" stroke={C.yellow} strokeWidth={2}
                    opacity={0.28 + 0.12 * Math.sin(frame * 0.18)} />
                  {gapAt !== undefined && (
                    <path d={arcPath(rEff, gapAt - 16, gapAt + 16)} fill="none"
                      stroke={C.yellow} strokeWidth={3.5} strokeDasharray="9 8"
                      strokeLinecap="round" opacity={0.6 + 0.25 * Math.sin(frame * 0.22)} />
                  )}
                </g>
              )}
            </g>
          );
        })}

        {electrons}

        <g opacity={nucP}>
          <circle r={nucR + 14} fill={nucleusColor} opacity={0.16} />
          <circle r={nucR} fill={"url(#nuc-" + uid + ")"} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
          {nucleons}
        </g>
      </svg>
    </div>
  );
};
`;

/* ---------------- src/components/Type.tsx ---------------- */
files["src/components/Type.tsx"] = `import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { EN, FA } from "../fonts";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const PersianTitle: React.FC<{
  text: React.ReactNode;
  size?: number;
  color?: string;
  delay?: number;
  weight?: number;
  align?: "center" | "right";
  style?: React.CSSProperties;
}> = ({ text, size = 48, color = C.white, delay = 0, weight = 800, align = "center", style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, delay, config: { damping: 20, stiffness: 110, mass: 0.8 } });
  return (
    <div
      dir="rtl"
      style={{
        fontFamily: FA,
        fontWeight: weight,
        fontSize: size,
        color,
        textAlign: align,
        lineHeight: 1.55,
        opacity: t,
        transform: "translateY(" + (1 - t) * 36 + "px)",
        textShadow: "0 6px 30px rgba(0,0,0,0.45)",
        ...style,
      }}
    >
      {text}
    </div>
  );
};

export const Kicker: React.FC<{
  text: string;
  delay?: number;
  align?: "center" | "right";
  color?: string;
}> = ({ text, delay = 0, align = "center", color = C.cyan }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [delay, delay + 18], [0, 1], cl);
  const y = interpolate(frame, [delay, delay + 18], [12, 0], cl);
  return (
    <div
      style={{
        fontFamily: EN, fontSize: 14, fontWeight: 500, letterSpacing: 7,
        color, textAlign: align, opacity: o, transform: "translateY(" + y + "px)", marginBottom: 8,
      }}
    >
      {text}
    </div>
  );
};

export const Pill: React.FC<{
  children: React.ReactNode;
  delay?: number;
  accent?: string;
  dir?: "rtl" | "ltr";
  fontSize?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, accent, dir = "rtl", fontSize = 21, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, delay, config: { damping: 18, stiffness: 130 } });
  return (
    <div
      dir={dir}
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "10px 20px", borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.22)",
        fontFamily: FA, fontWeight: 600, fontSize,
        color: C.white, opacity: t,
        transform: "translateY(" + (1 - t) * 18 + "px)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {accent ? (
        <span style={{ width: 10, height: 10, borderRadius: 999, background: accent, boxShadow: "0 0 12px " + accent }} />
      ) : null}
      {children}
    </div>
  );
};
`;

/* ---------------- src/components/Particles.tsx ---------------- */
files["src/components/Particles.tsx"] = `import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ParticleField: React.FC<{
  count?: number;
  seed?: string;
  color?: string;
  maxSize?: number;
  speed?: number;
  mode?: "drift" | "converge";
  range?: [number, number];
  opacity?: number;
}> = ({ count = 36, seed = "p", color = "rgba(34,211,238,0.55)", maxSize = 5, speed = 16, mode = "drift", range = [0, 300], opacity = 1 }) => {
  const frame = useCurrentFrame();
  const dots = [];
  for (let i = 0; i < count; i++) {
    const rx = random(seed + "x" + i) * 1920;
    const ry = random(seed + "y" + i) * 1080;
    const d = random(seed + "d" + i);
    const sz = 1.6 + d * maxSize;
    let x: number, y: number, o: number;
    if (mode === "drift") {
      const yy = ((ry - frame * speed * d) % 1080 + 1080) % 1080;
      x = rx + Math.sin(frame * 0.02 + i) * 22;
      y = yy;
      o = 0.5 + 0.5 * d;
    } else {
      const p = interpolate(frame, range, [0, 1], { ...cl, easing: Easing.inOut(Easing.cubic) });
      const pp = p * (0.35 + 0.65 * d);
      x = rx + (960 - rx) * pp + Math.sin(frame * 0.05 + i) * 8;
      y = ry + (540 - ry) * pp;
      o = (0.4 + 0.6 * d) * (1 - p * 0.55);
    }
    dots.push(
      <div
        key={i}
        style={{
          position: "absolute", left: x, top: y, width: sz, height: sz,
          borderRadius: 999, background: color, opacity: o * opacity,
          boxShadow: "0 0 " + (5 + sz * 2.4) + "px " + color, filter: "blur(0.4px)",
        }}
      />
    );
  }
  return <AbsoluteFill>{dots}</AbsoluteFill>;
};
`;

/* ---------------- src/components/Overlays.tsx ---------------- */
files["src/components/Overlays.tsx"] = `import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { EN } from "../fonts";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Watermark: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [10, 40], [0, 1], cl);
  const creditsDim = interpolate(frame, [4260, 4300], [1, 0.55], cl);
  return (
    <div
      style={{
        position: "absolute",
        right: 46,
        bottom: 42,
        fontFamily: EN,
        fontWeight: 300,
        fontSize: 16,
        letterSpacing: 3.5,
        color: "#FFFFFF",
        opacity: 0.62 * fadeIn * creditsDim,
        textShadow: "0 1px 8px rgba(0,0,0,0.6)",
        pointerEvents: "none",
      }}
    >
      AMIR ERFAN KHARAGHANI
    </div>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(120% 120% at 50% 45%, rgba(0,0,0,0) 55%, rgba(2,6,14,0.55) 100%)",
      pointerEvents: "none",
    }}
  />
);

const BOUNDS = [600, 1380, 2340, 3180, 3840, 4260];

export const WipeOverlays: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {BOUNDS.map((b, i) => {
        const local = frame - (b - 52);
        if (local < 0 || local > 68) return null;
        const p = interpolate(local, [0, 62], [0, 1], { ...cl, easing: Easing.inOut(Easing.cubic) });
        const p2 = interpolate(local, [6, 68], [0, 1], { ...cl, easing: Easing.inOut(Easing.cubic) });
        return (
          <AbsoluteFill key={i} style={{ overflow: "hidden" }}>
            <div
              style={{
                position: "absolute", top: "-20%", left: -170 + p * 300 + "%",
                width: "140%", height: "140%", background: C.navyLight,
                transform: "skewX(-14deg)", boxShadow: "0 0 120px rgba(0,0,0,0.5)",
              }}
            />
            <div
              style={{
                position: "absolute", top: "-20%", left: -170 + p2 * 300 + "%",
                width: "10%", height: "140%", background: C.cyan, opacity: 0.5,
                transform: "skewX(-14deg)",
              }}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
`;

/* ---------------- src/components/Lattice.tsx ---------------- */
files["src/components/Lattice.tsx"] = `import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { EN } from "../fonts";

export const Lattice: React.FC<{
  cols?: number; rows?: number; cell?: number; gap?: number; delay?: number;
}> = ({ cols = 3, rows = 3, cell = 58, gap = 8, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isNa = (r + c) % 2 === 0;
      const idx = r * cols + c;
      const s = spring({ frame, fps, delay: delay + idx * 3, config: { damping: 14, stiffness: 160 } });
      cells.push(
        <div
          key={idx}
          style={{
            position: "absolute", left: c * (cell + gap), top: r * (cell + gap),
            width: cell, height: cell, borderRadius: 12,
            background: isNa ? C.orange : C.cyan,
            transform: "scale(" + Math.max(0.001, s) + ")",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 28px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ fontFamily: EN, fontWeight: 700, fontSize: cell * 0.32, color: "#0B1E3A" }}>
            {isNa ? "+" : "\\u2212"}
          </span>
        </div>
      );
    }
  }
  return (
    <div style={{ position: "relative", width: cols * (cell + gap) - gap, height: rows * (cell + gap) - gap }}>
      {cells}
    </div>
  );
};
`;

/* ---------------- src/components/CollageArt.tsx ---------------- */
files["src/components/CollageArt.tsx"] = `import React from "react";
import { random } from "remotion";
import { C } from "../theme";
import { EN } from "../fonts";

export const CrystalPanel: React.FC = () => {
  const facets = [];
  for (let i = 0; i < 14; i++) {
    const x = 25 + random("cx" + i) * 215;
    const y = 18 + random("cy" + i) * 235;
    const s = 30 + random("cs" + i) * 55;
    const g = 120 + Math.floor(random("cg" + i) * 110);
    const rot = random("cr" + i) * 60 - 30;
    facets.push(
      <div
        key={i}
        style={{
          position: "absolute", left: x, top: y, width: s, height: s * 0.82,
          background: "rgb(" + g + "," + (g - 6) + "," + (g - 14) + ")",
          transform: "rotate(" + rot + "deg) skewX(-6deg)",
          clipPath: "polygon(20% 0, 100% 12%, 82% 100%, 0 78%)",
          boxShadow: "inset 0 0 18px rgba(255,255,255,0.25)",
        }}
      />
    );
  }
  return (
    <div style={{ width: 280, height: 330, background: "#EFECE4", position: "relative", overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.5)" }}>
      {facets}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34, background: "#0D0D0F", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: EN, fontSize: 10, letterSpacing: 3, color: "#D8D5CC", fontWeight: 500 }}>
          NaCl — CRYSTAL MACRO
        </span>
      </div>
    </div>
  );
};

const ROW2: [string, number][] = [["Li", 3], ["Be", 4], ["B", 5], ["C", 6], ["N", 7], ["O", 8], ["F", 9], ["Ne", 10]];
const ROW3: [string, number][] = [["Na", 11], ["Mg", 12], ["Al", 13], ["Si", 14], ["P", 15], ["S", 16], ["Cl", 17], ["Ar", 18]];

export const PeriodicPanel: React.FC = () => (
  <div style={{ width: 402, height: 268, background: "#0E1524", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 30px 60px rgba(0,0,0,0.5)", padding: "16px 14px" }}>
    <div style={{ fontFamily: EN, fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
      PERIODIC TABLE — FRAGMENT
    </div>
    {[ROW2, ROW3].map((row, ri) => (
      <div key={ri} style={{ display: "flex", gap: 5, marginBottom: 6 }}>
        {row.map(([sym, z]) => {
          const hot = sym === "Na" ? C.orange : sym === "Cl" ? C.cyan : null;
          return (
            <div
              key={sym}
              style={{
                width: 42, height: 50, borderRadius: 6,
                background: hot ? hot + "22" : "rgba(255,255,255,0.05)",
                border: hot ? "1.5px solid " + hot : "1px solid rgba(255,255,255,0.10)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}
            >
              <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 16, color: hot ?? "rgba(255,255,255,0.85)" }}>{sym}</span>
              <span style={{ fontFamily: EN, fontSize: 9, color: "rgba(255,255,255,0.45)" }}>{z}</span>
            </div>
          );
        })}
      </div>
    ))}
  </div>
);

export const GlasswarePanel: React.FC = () => (
  <div style={{ width: 250, height: 300, background: "#0C1420", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 30px 60px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden" }}>
    <svg width={250} height={260} viewBox="0 0 250 260">
      <path d="M 45 70 L 45 180 Q 45 196 61 196 L 99 196 Q 115 196 115 180 L 115 70" fill="none" stroke="#E9E6DE" strokeWidth={2} />
      <path d="M 38 70 L 52 70" stroke="#E9E6DE" strokeWidth={2} />
      <path d="M 52 150 L 108 150" stroke="rgba(233,230,222,0.5)" strokeWidth={2} />
      <path d="M 158 70 L 158 120 L 128 190 Q 124 200 134 200 L 182 200 Q 192 200 188 190 L 158 120" fill="none" stroke="#E9E6DE" strokeWidth={2} />
      <path d="M 150 70 L 166 70" stroke="#E9E6DE" strokeWidth={2} />
      <circle cx={150} cy={168} r={4} fill="rgba(34,211,238,0.6)" />
      <circle cx={165} cy={150} r={3} fill="rgba(34,211,238,0.45)" />
      <circle cx={80} cy={120} r={3} fill="rgba(255,197,61,0.5)" />
    </svg>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 32, background: "#0D0D0F", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: EN, fontSize: 10, letterSpacing: 3, color: "#D8D5CC", fontWeight: 500 }}>
        LAB — GRADE 10 CHEMISTRY
      </span>
    </div>
  </div>
);
`;

/* ---------------- src/ChemicalBonds.tsx ---------------- */
files["src/ChemicalBonds.tsx"] = `import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Noise } from "@remotion/noise";
import { AUDIO, C, FPS, SFX_DUR } from "./theme";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2Why } from "./scenes/Scene2Why";
import { Scene3Ionic } from "./scenes/Scene3Ionic";
import { Scene4Covalent } from "./scenes/Scene4Covalent";
import { Scene5Comparison } from "./scenes/Scene5Comparison";
import { Scene6Conclusion } from "./scenes/Scene6Conclusion";
import { Credits } from "./scenes/Credits";
import { Vignette, Watermark, WipeOverlays } from "./components/Overlays";

export const ChemicalBonds: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#060C18" }}>
      <AbsoluteFill
        style={{
          background: "radial-gradient(1400px 900px at 62% 38%, " + C.navyLight + " 0%, " + C.navy + " 48%, #060C18 100%)",
        }}
      />

      <Sequence from={0} durationInFrames={600} name="01 - Introduction"><Scene1Intro /></Sequence>
      <Sequence from={600} durationInFrames={780} name="02 - Why Do Atoms Bond"><Scene2Why /></Sequence>
      <Sequence from={1380} durationInFrames={960} name="03 - Ionic Bond"><Scene3Ionic /></Sequence>
      <Sequence from={2340} durationInFrames={840} name="04 - Covalent Bond"><Scene4Covalent /></Sequence>
      <Sequence from={3180} durationInFrames={660} name="05 - Comparison"><Scene5Comparison /></Sequence>
      <Sequence from={3840} durationInFrames={420} name="06 - Conclusion"><Scene6Conclusion /></Sequence>
      <Sequence from={4260} durationInFrames={360} name="07 - Credits"><Credits /></Sequence>

      <WipeOverlays />
      <Noise opacity={0.05} />
      <Vignette />
      <Watermark />

      {/* Persian narration slot — put narration.mp3 in public/ and uncomment:
      <Sequence from={0}>
        <Audio src={staticFile("narration.mp3")} volume={1} />
      </Sequence>
      */}

      {AUDIO.map((c, i) => (
        <Sequence
          key={i}
          from={c.frame}
          durationInFrames={Math.ceil(SFX_DUR[c.file] * FPS) + 2}
          name={"sfx-" + c.file + "-" + c.frame}
        >
          <Audio src={staticFile("sfx/" + c.file + ".wav")} volume={c.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
`;

/* ---------------- scenes ---------------- */
files["src/scenes/Scene1Intro.tsx"] = `import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { Atom } from "../components/Atom";
import { ParticleField } from "../components/Particles";
import { Kicker, PersianTitle } from "../components/Type";
import { CrystalPanel, GlasswarePanel, PeriodicPanel } from "../components/CollageArt";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const seg = (f: number, a: number, b: number, o0 = 0, o1 = 1, e?: (t: number) => number) =>
  interpolate(f, [a, b], [o0, o1], { ...cl, easing: e });

export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cam = seg(frame, 0, 600, 1.0, 1.07);
  const panelA = spring({ frame, fps, delay: 140, config: { damping: 16, stiffness: 90 } });
  const panelB = spring({ frame, fps, delay: 250, config: { damping: 16, stiffness: 90 } });
  const panelC = spring({ frame, fps, delay: 355, config: { damping: 16, stiffness: 90 } });
  const shape1 = seg(frame, 90, 130, 0, 1, Easing.out(Easing.back(1.5)));
  const build = seg(frame, 0, 480, 0, 1);
  const titleIn = seg(frame, 415, 470, 0, 1);
  const titleDim = seg(frame, 545, 600, 1, 0.25);

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transform: "scale(" + cam + ")" }}>
        <ParticleField count={42} seed="s1a" color="rgba(34,211,238,0.5)" maxSize={5} speed={14} />
        <ParticleField count={18} seed="s1b" color="rgba(255,197,61,0.4)" maxSize={3.5} speed={9} />

        <div style={{ position: "absolute", left: 600, top: 105, width: 180, height: 180, borderRadius: 999, background: C.yellow, opacity: shape1 * 0.9, transform: "scale(" + shape1 + ")", boxShadow: "0 30px 80px rgba(255,197,61,0.25)" }} />
        <div style={{ position: "absolute", left: 690, top: 690, width: 210, height: 16, background: C.cyan, transform: "rotate(-9deg) scaleX(" + seg(frame, 245, 290, 0, 1) + ")", transformOrigin: "left center", opacity: 0.85 }} />
        <div style={{ position: "absolute", left: 855, top: 585, width: 130, height: 116, background: C.orange, clipPath: "polygon(50% 0, 100% 100%, 0 100%)", transform: "rotate(10deg) scale(" + seg(frame, 350, 395, 0, 1, Easing.out(Easing.back(1.5))) + ")", opacity: 0.9 }} />

        <div style={{ position: "absolute", left: 150, top: 150, transform: "rotate(-4deg) translateX(" + (1 - panelA) * -110 + "px)", opacity: panelA }}><CrystalPanel /></div>
        <div style={{ position: "absolute", left: 400, top: 420, transform: "rotate(3deg) translateX(" + (1 - panelB) * -110 + "px)", opacity: panelB }}><PeriodicPanel /></div>
        <div style={{ position: "absolute", left: 135, top: 540, transform: "rotate(6deg) translateX(" + (1 - panelC) * -110 + "px)", opacity: panelC }}><GlasswarePanel /></div>

        <ParticleField count={30} seed="s1c" color="rgba(255,255,255,0.5)" maxSize={4} mode="converge" range={[260, 480]} />
        <div style={{ position: "absolute", left: 1255, top: 460 }}>
          <Atom uid="s1carbon" protons={6} neutrons={6}
            shells={[{ electrons: 2, radius: 78 }, { electrons: 4, radius: 138 }]}
            build={build} size={0.92} />
        </div>
      </div>

      <div style={{ position: "absolute", right: 150, bottom: 168, textAlign: "right", opacity: titleIn * titleDim, transform: "translateY(" + (1 - titleIn) * 40 + "px)" }}>
        <Kicker text="PART 01 — THE INVISIBLE WORLD" align="right" delay={420} />
        <PersianTitle text="«جهان از اتم‌ها ساخته شده است»" size={56} color={C.yellow} weight={900} align="right" delay={432} />
      </div>
    </AbsoluteFill>
  );
};
`;

files["src/scenes/Scene2Why.tsx"] = `import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { FA } from "../fonts";
import { Atom } from "../components/Atom";
import { Kicker, PersianTitle, Pill } from "../components/Type";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const seg = (f: number, a: number, b: number, o0 = 0, o1 = 1, e?: (t: number) => number) =>
  interpolate(f, [a, b], [o0, o1], { ...cl, easing: e });

export const Scene2Why: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const build = seg(frame, 90, 330, 0, 1);
  const bigT = seg(frame, 330, 385, 0, 1, Easing.inOut(Easing.cubic));
  const driftT = seg(frame, 615, 760, 0, 1, Easing.inOut(Easing.cubic));

  const arX = 960 + 285 * bigT - 85 * driftT;
  const fX = 655 + 105 * driftT;
  const arScale = 1 - 0.3 * bigT;

  const arIn = spring({ frame, fps, delay: 84, config: { damping: 18, stiffness: 80 } });
  const fIn = spring({ frame, fps, delay: 336, config: { damping: 16, stiffness: 100 } });

  const shells = [72, 124, 176];
  const digits = ["\\u06f2", "\\u06f8", "\\u06f8"];

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 84, textAlign: "center", opacity: seg(frame, 0, 30, 0, 1) * seg(frame, 60, 95, 1, 0.15) }}>
        <Kicker text="PART 02 — THE RULE OF OCTET" delay={4} />
        <PersianTitle text="«چرا اتم‌ها پیوند تشکیل می‌دهند؟»" size={44} weight={900} delay={10} />
      </div>

      <div style={{ position: "absolute", left: arX, top: 520 }}>
        <div style={{ transform: "scale(" + arScale + ")", opacity: arIn, position: "relative", width: 0, height: 0 }}>
          <div style={{ position: "absolute" }}>
            <Atom uid="argon" protons={18} neutrons={22}
              shells={[{ electrons: 2, radius: 72 }, { electrons: 8, radius: 124 }, { electrons: 8, radius: 176 }]}
              build={build} valenceGlow />
          </div>
          {shells.map((r, i) => (
            <div key={i} style={{ position: "absolute", left: r + 24, top: -14, fontFamily: FA, fontSize: 19, fontWeight: 600, color: "rgba(255,255,255,0.6)", opacity: seg(frame, 130 + i * 60, 150 + i * 60, 0, 1) * (1 - bigT) }}>
              {digits[i]}
            </div>
          ))}
          <div style={{ position: "absolute", left: 0, top: 248, transform: "translateX(-50%)", opacity: seg(frame, 385, 415, 0, 1) }}>
            <Pill accent={C.yellow}>آرگون Ar — آرایش پایدار هشتایی</Pill>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: arX + 135, top: 295, transform: "translateX(-50%)", opacity: seg(frame, 255, 285, 0, 1) * (1 - bigT) }}>
        <Pill accent={C.yellow} fontSize={19}>الکترون‌های ظرفیت</Pill>
      </div>
      <div style={{ position: "absolute", left: arX + 135, top: 348, width: 1.5, height: 66, background: "linear-gradient(180deg, rgba(255,197,61,0.7), rgba(255,197,61,0))", transform: "translateX(-50%)", opacity: seg(frame, 255, 285, 0, 1) * (1 - bigT) }} />

      <div style={{ position: "absolute", left: fX, top: 520 }}>
        <div style={{ transform: "scale(0.72)", opacity: fIn, position: "relative", width: 0, height: 0 }}>
          <div style={{ position: "absolute" }}>
            <Atom uid="fluorine" protons={9} neutrons={10}
              shells={[{ electrons: 2, radius: 72 }, { electrons: 7, radius: 124 }]}
              build={seg(frame, 340, 470, 0, 1)} valenceGlow flicker={1} />
          </div>
          <div style={{ position: "absolute", left: 0, top: 205, transform: "translateX(-50%)", opacity: seg(frame, 400, 430, 0, 1) }}>
            <Pill accent={C.cyan}>فلوئور F — \\u06f7 الکترون ظرفیت</Pill>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 960, top: 868, transform: "translateX(-50%)", opacity: seg(frame, 560, 595, 0, 1) }}>
        <Pill fontSize={19} style={{ whiteSpace: "normal", maxWidth: 780, justifyContent: "center", textAlign: "center" }}>
          برای رسیدن به آرایش پایدار، اتم‌ها الکترون می‌دهند، می‌گیرند یا به اشتراک می‌گذارند
        </Pill>
      </div>
    </AbsoluteFill>
  );
};
`;

files["src/scenes/Scene3Ionic.tsx"] = `import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { EN } from "../fonts";
import { Atom, degToRad } from "../components/Atom";
import { Kicker, PersianTitle, Pill } from "../components/Type";
import { Lattice } from "../components/Lattice";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const seg = (f: number, a: number, b: number, o0 = 0, o1 = 1, e?: (t: number) => number) =>
  interpolate(f, [a, b], [o0, o1], { ...cl, easing: e });

const bez = (p: number, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => ({
  x: (1 - p) * (1 - p) * a.x + 2 * (1 - p) * p * b.x + p * p * c.x,
  y: (1 - p) * (1 - p) * a.y + 2 * (1 - p) * p * b.y + p * p * c.y,
});

export const Scene3Ionic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const naBuild = seg(frame, 120, 240, 0, 1);
  const clBuild = seg(frame, 300, 420, 0, 1);
  const ionT = seg(frame, 575, 618, 0, 1, Easing.inOut(Easing.cubic));
  const attractT = seg(frame, 660, 748, 0, 1, Easing.inOut(Easing.cubic));
  const outT = seg(frame, 780, 815, 1, 0);

  const Y = 480;
  const naX = 1330 - 215 * attractT;
  const clX = 590 + 215 * attractT;

  const tp = seg(frame, 480, 568, 0, 1, Easing.inOut(Easing.cubic));
  const a = { x: 1330 + 170 * Math.cos(degToRad(200)), y: Y + 170 * Math.sin(degToRad(200)) };
  const cEnd = { x: 590 + 170 * Math.cos(degToRad(-18)), y: Y + 170 * Math.sin(degToRad(-18)) };
  const b = { x: 960, y: 250 };

  const eqIn = seg(frame, 585, 625, 0, 1);
  const dashO = seg(frame, 658, 682, 0, 1) * seg(frame, 762, 790, 1, 0);
  const latIn = spring({ frame, fps, delay: 815, config: { damping: 15, stiffness: 120 } });

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 78, textAlign: "center" }}>
        <Kicker text="PART 03 — IONIC BOND" delay={4} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginTop: 8 }}>
          <PersianTitle text="«پیوند یونی»" size={44} weight={900} delay={10} />
          <Pill accent={C.orange} delay={26} fontSize={19}>انتقال الکترون</Pill>
        </div>
      </div>

      <div style={{ position: "absolute", left: naX, top: Y, opacity: outT }}>
        <div style={{ position: "relative", width: 0, height: 0, opacity: 1 - ionT }}>
          <div style={{ position: "absolute" }}>
            <Atom uid="na0" protons={11} neutrons={12} electronColor={C.orange} valenceGlow build={naBuild}
              shells={[{ electrons: 2, radius: 66 }, { electrons: 8, radius: 114 }, { electrons: 1, radius: 168 }]} />
          </div>
        </div>
        <div style={{ position: "relative", width: 0, height: 0, opacity: ionT }}>
          <div style={{ position: "absolute" }}>
            <Atom uid="na1" protons={11} neutrons={12} electronColor={C.orange} build={1}
              shells={[{ electrons: 2, radius: 66 }, { electrons: 8, radius: 97 }]} />
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: clX, top: Y, opacity: outT }}>
        <div style={{ position: "relative", width: 0, height: 0, opacity: 1 - ionT }}>
          <div style={{ position: "absolute" }}>
            <Atom uid="cl0" protons={17} neutrons={18} valenceGlow gapAt={-18} build={clBuild}
              shells={[{ electrons: 2, radius: 72 }, { electrons: 8, radius: 120 }, { electrons: 7, radius: 170 }]} />
          </div>
        </div>
        <div style={{ position: "relative", width: 0, height: 0, opacity: ionT }}>
          <div style={{ position: "absolute" }}>
            <Atom uid="cl1" protons={17} neutrons={18} build={1}
              shells={[{ electrons: 2, radius: 72 }, { electrons: 8, radius: 120 }, { electrons: 8, radius: 184 }]} />
          </div>
        </div>
      </div>

      {[0, 0.06, 0.12, 0.18, 0.24].map((d, i) => {
        const pp = Math.max(0, tp - d);
        if (pp <= 0 || pp >= 1) return null;
        const pos = bez(pp, a, b, cEnd);
        return (
          <div key={i} style={{
            position: "absolute", left: pos.x, top: pos.y, transform: "translate(-50%,-50%)",
            width: 18 - i * 2.4, height: 18 - i * 2.4, borderRadius: 999,
            background: C.orange, opacity: (1 - i * 0.18) * (1 - seg(frame, 566, 584, 0, 1)),
            boxShadow: "0 0 18px " + C.orange,
          }} />
        );
      })}

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: dashO }}>
        <line x1={clX + 100} y1={Y} x2={naX - 100} y2={Y}
          stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeDasharray="10 12" strokeDashoffset={-frame * 1.6} />
      </svg>

      <div style={{ position: "absolute", left: naX, top: 248, transform: "translateX(-50%)", opacity: ionT }}>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 26, color: C.yellow, border: "1.5px solid " + C.yellow, borderRadius: 12, padding: "6px 16px", background: "rgba(255,197,61,0.12)", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
          Na<sup>+</sup>
        </div>
      </div>
      <div style={{ position: "absolute", left: clX, top: 248, transform: "translateX(-50%)", opacity: ionT }}>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 26, color: C.cyan, border: "1.5px solid " + C.cyan, borderRadius: 12, padding: "6px 16px", background: "rgba(34,211,238,0.12)", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
          Cl<sup>\\u2212</sup>
        </div>
      </div>

      <div style={{ position: "absolute", left: naX, top: 700, transform: "translateX(-50%)", opacity: seg(frame, 130, 160, 0, 1) * outT }}>
        <Pill accent={C.orange}>سدیم Na</Pill>
      </div>
      <div style={{ position: "absolute", left: naX, top: 758, transform: "translateX(-50%)", opacity: seg(frame, 175, 200, 0, 1) * (1 - ionT) * outT }}>
        <Pill fontSize={17} style={{ color: "rgba(255,255,255,0.85)" }}>لایه‌ها: ۲ ، ۸ ، ۱</Pill>
      </div>
      <div style={{ position: "absolute", left: naX, top: 758, transform: "translateX(-50%)", opacity: ionT * outT }}>
        <Pill fontSize={17} style={{ color: "rgba(255,255,255,0.85)" }}>لایه‌ها: ۲ ، ۸ — پایدار</Pill>
      </div>

      <div style={{ position: "absolute", left: clX, top: 700, transform: "translateX(-50%)", opacity: seg(frame, 310, 340, 0, 1) * outT }}>
        <Pill accent={C.cyan}>کلر Cl</Pill>
      </div>
      <div style={{ position: "absolute", left: clX, top: 758, transform: "translateX(-50%)", opacity: seg(frame, 355, 380, 0, 1) * (1 - ionT) * outT }}>
        <Pill fontSize={17} style={{ color: "rgba(255,255,255,0.85)" }}>لایه‌ها: ۲ ، ۸ ، ۷</Pill>
      </div>
      <div style={{ position: "absolute", left: clX, top: 758, transform: "translateX(-50%)", opacity: ionT * outT }}>
        <Pill fontSize={17} style={{ color: "rgba(255,255,255,0.85)" }}>لایه‌ها: ۲ ، ۸ ، ۸ — پایدار</Pill>
      </div>

      <div style={{ position: "absolute", left: 960, top: 368, transform: "translateX(-50%)", opacity: seg(frame, 700, 730, 0, 1) * outT }}>
        <Pill accent={C.yellow}>جاذبه الکتروستاتیک</Pill>
      </div>

      <div dir="ltr" style={{ position: "absolute", left: 0, right: 0, top: 832, textAlign: "center", opacity: eqIn * seg(frame, 790, 815, 1, 0) }}>
        <div style={{ fontFamily: EN, fontWeight: 500, fontSize: 30, color: "rgba(255,255,255,0.95)", letterSpacing: 1 }}>
          Na → Na<sup>+</sup> + e<sup>\\u2212</sup>
        </div>
        <div style={{ marginTop: 12, fontFamily: EN, fontWeight: 500, fontSize: 30, color: "rgba(255,255,255,0.95)" }}>
          Cl + e<sup>\\u2212</sup> → Cl<sup>\\u2212</sup>
        </div>
      </div>

      <div style={{ position: "absolute", left: 960, top: 470, transform: "translate(-50%,-50%) scale(" + Math.max(0.001, latIn) + ")", opacity: latIn }}>
        <Lattice cols={3} rows={3} cell={58} gap={8} delay={815} />
      </div>
      <div style={{ position: "absolute", left: 960, top: 705, transform: "translateX(-50%)", opacity: seg(frame, 885, 915, 0, 1) }}>
        <Pill accent={C.cyan}>شبکه بلوری نمک طعام (NaCl)</Pill>
      </div>
    </AbsoluteFill>
  );
};
`;

files["src/scenes/Scene4Covalent.tsx"] = `import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { EN } from "../fonts";
import { degToRad } from "../components/Atom";
import { Kicker, PersianTitle, Pill } from "../components/Type";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const seg = (f: number, a: number, b: number, o0 = 0, o1 = 1, e?: (t: number) => number) =>
  interpolate(f, [a, b], [o0, o1], { ...cl, easing: e });

export const Scene4Covalent: React.FC = () => {
  const frame = useCurrentFrame();

  const hIn = seg(frame, 100, 160, 0, 1);
  const dist = interpolate(frame, [100, 180, 240, 360], [430, 330, 330, 150], { ...cl, easing: Easing.inOut(Easing.cubic) });
  const h1x = 960 - dist;
  const h2x = 960 + dist;
  const overlapT = seg(frame, 300, 380, 0, 1);
  const pairT = seg(frame, 420, 540, 0, 1, Easing.inOut(Easing.cubic));
  const bondT = seg(frame, 480, 540, 0, 1);
  const pairAngle = frame * 2.4;

  const orbA = frame * 3.2;
  const orb1 = { x: h1x + 62 * Math.cos(degToRad(orbA)), y: 540 + 62 * Math.sin(degToRad(orbA)) };
  const orb2 = { x: h2x + 62 * Math.cos(degToRad(orbA + 140)), y: 540 + 62 * Math.sin(degToRad(orbA + 140)) };
  const mid = { x: (h1x + h2x) / 2, y: 540 };
  const sh1 = { x: mid.x + 20 * Math.cos(degToRad(pairAngle)), y: 540 + 20 * Math.sin(degToRad(pairAngle)) };
  const sh2 = { x: mid.x + 20 * Math.cos(degToRad(pairAngle + 180)), y: 540 + 20 * Math.sin(degToRad(pairAngle + 180)) };
  const e1 = { x: orb1.x + (sh1.x - orb1.x) * pairT, y: orb1.y + (sh1.y - orb1.y) * pairT };
  const e2 = { x: orb2.x + (sh2.x - orb2.x) * pairT, y: orb2.y + (sh2.y - orb2.y) * pairT };

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 78, textAlign: "center" }}>
        <Kicker text="PART 04 — COVALENT BOND" delay={4} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginTop: 8 }}>
          <PersianTitle text="«پیوند کووالانسی»" size={44} weight={900} delay={10} />
          <Pill accent={C.cyan} delay={26} fontSize={19}>اشتراک‌گذاری الکترون‌ها</Pill>
        </div>
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="s4halo">
            <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <radialGradient id="s4glow">
            <stop offset="0%" stopColor="rgba(255,197,61,0.5)" />
            <stop offset="100%" stopColor="rgba(255,197,61,0)" />
          </radialGradient>
        </defs>

        <circle cx={h1x} cy={540} r={95} fill="url(#s4halo)" opacity={hIn} />
        <circle cx={h2x} cy={540} r={95} fill="url(#s4halo)" opacity={hIn} />
        <circle cx={h1x} cy={540} r={62} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} opacity={hIn} />
        <circle cx={h2x} cy={540} r={62} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} opacity={hIn} />

        <circle cx={mid.x} cy={540} r={85} fill="url(#s4glow)" opacity={overlapT} />

        <line x1={h1x + 18} y1={540} x2={h2x - 18} y2={540}
          stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} opacity={bondT} />

        <circle cx={h1x} cy={540} r={20} fill={C.orange} opacity={0.25 * hIn} />
        <circle cx={h1x} cy={540} r={13} fill={C.orange} opacity={hIn} />
        <circle cx={h2x} cy={540} r={20} fill={C.orange} opacity={0.25 * hIn} />
        <circle cx={h2x} cy={540} r={13} fill={C.orange} opacity={hIn} />

        <circle cx={e1.x} cy={e1.y} r={13} fill={C.cyan} opacity={0.2 * hIn} />
        <circle cx={e1.x} cy={e1.y} r={6.5} fill={C.cyan} opacity={hIn} />
        <circle cx={e2.x} cy={e2.y} r={13} fill={C.cyan} opacity={0.2 * hIn} />
        <circle cx={e2.x} cy={e2.y} r={6.5} fill={C.cyan} opacity={hIn} />
      </svg>

      <div style={{ position: "absolute", left: h1x, top: 672, transform: "translateX(-50%)", opacity: hIn }}>
        <Pill accent={C.orange} fontSize={18}>هیدروژن H</Pill>
      </div>
      <div style={{ position: "absolute", left: h2x, top: 672, transform: "translateX(-50%)", opacity: hIn }}>
        <Pill accent={C.orange} fontSize={18}>هیدروژن H</Pill>
      </div>

      <div style={{ position: "absolute", left: 960, top: 356, transform: "translateX(-50%)", opacity: seg(frame, 555, 590, 0, 1), textAlign: "center" }}>
        <div dir="ltr" style={{ fontFamily: EN, fontWeight: 700, fontSize: 52, color: C.white, letterSpacing: 2 }}>H–H</div>
        <div style={{ marginTop: 10 }}>
          <Pill accent={C.cyan} fontSize={19}>
            مولکول <span dir="ltr" style={{ fontFamily: EN }}>H<sub>2</sub></span>
          </Pill>
        </div>
      </div>

      <div style={{ position: "absolute", left: 960, top: 856, transform: "translateX(-50%)", opacity: seg(frame, 600, 635, 0, 1) }}>
        <Pill fontSize={19}>هر اتم به آرایش پایدار دوپای هلیوم می‌رسد</Pill>
      </div>
    </AbsoluteFill>
  );
};
`;

files["src/scenes/Scene5Comparison.tsx"] = `import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { EN, FA } from "../fonts";
import { Kicker, PersianTitle } from "../components/Type";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const seg = (f: number, a: number, b: number, o0 = 0, o1 = 1, e?: (t: number) => number) =>
  interpolate(f, [a, b], [o0, o1], { ...cl, easing: e });

const IonicIcon = () => (
  <svg width={170} height={115} style={{ overflow: "visible" }}>
    <circle cx={45} cy={42} r={20} fill={C.orange} />
    <circle cx={45} cy={42} r={33} fill="none" stroke="rgba(255,255,255,0.28)" />
    <circle cx={128} cy={42} r={20} fill={C.cyan} />
    <circle cx={128} cy={42} r={33} fill="none" stroke="rgba(255,255,255,0.28)" />
    <line x1={72} y1={42} x2={100} y2={42} stroke={C.yellow} strokeWidth={2.5} strokeDasharray="6 5" />
    <polygon points="104,42 94,37 94,47" fill={C.yellow} />
    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy], i) => (
      <rect key={i} x={74 + cx * 24} y={82 + cy * 16} width={22} height={14} rx={3}
        fill={(cx + cy) % 2 === 0 ? C.orange : C.cyan} opacity={0.85} />
    ))}
  </svg>
);

const CovalentIcon = () => (
  <svg width={170} height={115} style={{ overflow: "visible" }}>
    <circle cx={55} cy={42} r={17} fill="none" stroke={C.white} strokeWidth={2.5} opacity={0.9} />
    <circle cx={55} cy={42} r={8} fill={C.orange} />
    <circle cx={118} cy={42} r={17} fill="none" stroke={C.white} strokeWidth={2.5} opacity={0.9} />
    <circle cx={118} cy={42} r={8} fill={C.orange} />
    <line x1={55} y1={42} x2={118} y2={42} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
    <circle cx={86} cy={30} r={5} fill={C.yellow} />
    <circle cx={86} cy={54} r={5} fill={C.yellow} />
  </svg>
);

const Row: React.FC<{ children: React.ReactNode; accent: string; t: number }> = ({ children, accent, t }) => (
  <div dir="rtl" style={{
    display: "flex", alignItems: "center", gap: 12, width: "100%",
    padding: "13px 22px", borderRadius: 14, marginBottom: 14,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
    fontFamily: FA, fontSize: 23, fontWeight: 600, color: C.white,
    opacity: t, transform: "translateX(" + (1 - t) * 24 + "px)",
  }}>
    <span style={{ width: 9, height: 9, borderRadius: 999, background: accent, flexShrink: 0 }} />
    {children}
  </div>
);

export const Scene5Comparison: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const divT = spring({ frame, fps, delay: 2, config: { damping: 16, stiffness: 110 } });
  const flash = Math.max(0, 1 - Math.abs(frame - 540) / 20);
  const panelIn = seg(frame, 20, 60, 0, 1);

  const panelStyle = (side: "right" | "left", accent: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute", top: 210, width: 840, height: 740,
      borderRadius: 26, background: "rgba(255,255,255,0.045)",
      border: "1px solid rgba(255,255,255,0.10)", borderTop: "4px solid " + accent,
      opacity: panelIn, transform: "scale(" + (1 + flash * 0.012) + ")",
      boxShadow: flash > 0 ? "0 0 " + 40 * flash + "px " + accent + "55" : "none",
      padding: "36px 40px",
    };
    if (side === "right") base.right = 80; else base.left = 80;
    return base;
  };

  const rightRows = [
    { d: 120, text: "انتقال الکترون" },
    { d: 180, text: "فلز + نافلز" },
    { d: 240, text: "تشکیل شبکه بلوری" },
    { d: 300, text: "مثال: NaCl" },
  ];
  const leftRows: { d: number; node: React.ReactNode }[] = [
    { d: 150, node: "اشتراک الکترون" },
    { d: 210, node: "نافلز + نافلز" },
    { d: 270, node: "تشکیل مولکول" },
    { d: 330, node: <>مثال: <span dir="ltr" style={{ fontFamily: EN }}>H<sub>2</sub></span></> },
  ];

  return (
    <AbsoluteFill>
      <Kicker text="PART 05 — TRANSFER vs SHARING" delay={4} />
      <div style={{ marginTop: 4 }}>
        <PersianTitle text="«انتقال الکترون در برابر اشتراک الکترون»" size={38} weight={900} delay={8} />
      </div>

      <div style={{
        position: "absolute", left: 958, top: 200, width: 3, height: 760,
        background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.7), transparent)",
        transform: "scaleY(" + divT + ")", transformOrigin: "center",
      }} />

      <div style={panelStyle("right", C.orange)}>
        <div style={{ textAlign: "center", marginBottom: 22 }}><IonicIcon /></div>
        {rightRows.map((r, i) => (
          <Row key={i} accent={C.orange} t={seg(frame, r.d, r.d + 26, 0, 1)}>{r.text}</Row>
        ))}
      </div>

      <div style={panelStyle("left", C.cyan)}>
        <div style={{ textAlign: "center", marginBottom: 22 }}><CovalentIcon /></div>
        {leftRows.map((r, i) => (
          <Row key={i} accent={C.cyan} t={seg(frame, r.d, r.d + 26, 0, 1)}>{r.node}</Row>
        ))}
      </div>
    </AbsoluteFill>
  );
};
`;

files["src/scenes/Scene6Conclusion.tsx"] = `import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { EN, FA } from "../fonts";
import { ParticleField } from "../components/Particles";
import { Kicker, PersianTitle } from "../components/Type";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const seg = (f: number, a: number, b: number, o0 = 0, o1 = 1, e?: (t: number) => number) =>
  interpolate(f, [a, b], [o0, o1], { ...cl, easing: e });

const LatticeMini = () => (
  <div style={{ position: "relative", width: 158, height: 106 }}>
    {[0, 1, 2].map((c) =>
      [0, 1].map((r) => {
        const isNa = (c + r) % 2 === 0;
        return (
          <div key={c + "-" + r} style={{
            position: "absolute", left: c * 54, top: r * 54, width: 46, height: 46,
            borderRadius: 10, background: isNa ? C.orange : C.cyan,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: EN, fontWeight: 700, fontSize: 18, color: "#0B1E3A",
            boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
          }}>
            {isNa ? "+" : "\\u2212"}
          </div>
        );
      })
    )}
  </div>
);

const H2Mini = () => (
  <svg width={140} height={90} style={{ overflow: "visible" }}>
    <line x1={35} y1={45} x2={105} y2={45} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
    <circle cx={35} cy={45} r={15} fill={C.orange} />
    <circle cx={105} cy={45} r={15} fill={C.orange} />
    <circle cx={70} cy={38} r={5.5} fill={C.yellow} />
    <circle cx={70} cy={52} r={5.5} fill={C.yellow} />
  </svg>
);

const H2OMini = () => {
  const H = [
    { x: -51, y: 32 },
    { x: 51, y: 32 },
  ];
  const pairs = H.map((h) => {
    const mx = h.x * 0.5, my = h.y * 0.5;
    const len = Math.hypot(h.x, h.y);
    const nx = -h.y / len, ny = h.x / len;
    return [
      { x: mx + nx * 5, y: my + ny * 5 },
      { x: mx - nx * 5, y: my - ny * 5 },
    ];
  });
  return (
    <svg width={170} height={110} viewBox="-85 -55 170 110" style={{ overflow: "visible", transform: "translateY(-12px)" }}>
      {H.map((h, i) => (
        <line key={"l" + i} x1={0} y1={0} x2={h.x} y2={h.y} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
      ))}
      {pairs.flat().map((p, i) => (
        <circle key={"p" + i} cx={p.x} cy={p.y} r={4.5} fill={C.yellow} />
      ))}
      <circle cx={0} cy={0} r={30} fill="none" stroke="rgba(34,211,238,0.3)" />
      <circle cx={0} cy={0} r={21} fill={C.cyan} opacity={0.95} />
      {H.map((h, i) => (
        <circle key={"h" + i} cx={h.x} cy={h.y} r={11} fill={C.orange} />
      ))}
    </svg>
  );
};

export const Scene6Conclusion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cam = seg(frame, 0, 420, 1.0, 1.07);
  const dim = seg(frame, 240, 275, 1, 0.72);

  const mols = [
    { x: 1320, delay: 60, comp: <LatticeMini />, sym: "NaCl", fa: "نمک طعام" },
    { x: 960, delay: 110, comp: <H2Mini />, sym: <>H<sub>2</sub></>, fa: "هیدروژن" },
    { x: 600, delay: 160, comp: <H2OMini />, sym: <>H<sub>2</sub>O</>, fa: "آب" },
  ];

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transform: "scale(" + cam + ")" }}>
        <ParticleField count={54} seed="s6a" color="rgba(34,211,238,0.5)" maxSize={4.5} mode="converge" range={[0, 180]} />
        <ParticleField count={22} seed="s6b" color="rgba(255,197,61,0.42)" maxSize={3.5} mode="converge" range={[40, 220]} />

        {mols.map((m, i) => {
          const s = spring({ frame, fps, delay: m.delay, config: { damping: 15, stiffness: 110 } });
          return (
            <div key={i} style={{
              position: "absolute", left: m.x, top: 500, transform: "translate(-50%,-50%)",
              opacity: dim,
            }}>
              <div style={{ transform: "scale(" + Math.max(0.001, s) + ")", display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
                {m.comp}
                <div style={{ textAlign: "center" }}>
                  <div dir="ltr" style={{ fontFamily: EN, fontWeight: 600, fontSize: 22, color: "rgba(255,255,255,0.9)", letterSpacing: 2 }}>{m.sym}</div>
                  <div style={{ fontFamily: FA, fontSize: 15, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{m.fa}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 200, textAlign: "center" }}>
        <Kicker text="PART 06 — THE WORLD OF MATTER" delay={232} />
        <PersianTitle text="«اتصال اتم‌ها، آغاز دنیای مواد»" size={54} color={C.yellow} weight={900} delay={240} />
      </div>

      <AbsoluteFill style={{ background: "#060C18", opacity: seg(frame, 398, 420, 0, 1) }} />
    </AbsoluteFill>
  );
};
`;

files["src/scenes/Credits.tsx"] = `import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { EN } from "../fonts";
import { ParticleField } from "../components/Particles";
import { degToRad } from "../components/Atom";

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const WireMol: React.FC<{ x: number; y: number; r: number; seed: number; speed: number }> = ({ x, y, r, seed, speed }) => {
  const frame = useCurrentFrame();
  const rot = frame * speed + seed;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = degToRad(rot + i * 60);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.9 };
  });
  return (
    <svg
      width={r * 2.4} height={r * 2.4}
      viewBox={-r * 1.2 + " " + -r * 1.2 + " " + r * 2.4 + " " + r * 2.4}
      style={{ position: "absolute", left: x - r * 1.2, top: y - r * 1.2, overflow: "visible", opacity: 0.9 }}
    >
      {pts.map((p, i) => {
        const q = pts[(i + 1) % 6];
        return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="rgba(255,255,255,0.10)" strokeWidth={1.5} />;
      })}
      {pts.map((p, i) => (
        <circle key={"c" + i} cx={p.x} cy={p.y} r={9} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
      ))}
      <circle cx={0} cy={0} r={7} fill="rgba(255,255,255,0.12)" />
    </svg>
  );
};

const LINES: { label: string; value: string; big?: boolean }[] = [
  { label: "PROJECT:", value: "CHEMICAL BONDS" },
  { label: "STUDENT:", value: "AMIR ERFAN KHARAGHANI", big: true },
  { label: "SUBJECT:", value: "CHEMISTRY" },
  { label: "TEACHER:", value: "MR. SAYAD KHANLOO" },
  { label: "SCHOOL:", value: "SOLEIMANI SCHOOL" },
  { label: "GRADE:", value: "10TH GRADE" },
  { label: "ACADEMIC TRACK:", value: "EXPERIMENTAL SCIENCES" },
];

export const Credits: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let y = 268;
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy }}>
      <ParticleField count={30} seed="cr" color="rgba(34,211,238,0.4)" maxSize={4} speed={8} />
      <WireMol x={330} y={280} r={120} seed={20} speed={0.25} />
      <WireMol x={1610} y={330} r={95} seed={80} speed={-0.2} />
      <WireMol x={960} y={905} r={140} seed={140} speed={0.16} />

      {LINES.map((l, i) => {
        const t = spring({ frame, fps, delay: 26 + i * 28, config: { damping: 17, stiffness: 120 } });
        const row = (
          <div key={i} style={{
            position: "absolute", left: 0, right: 0, top: y, textAlign: "center",
            opacity: t, transform: "translateY(" + (1 - t) * 26 + "px)",
          }}>
            <span style={{
              fontFamily: EN, fontSize: l.big ? 17 : 14, fontWeight: 500,
              letterSpacing: 5, color: "rgba(255,255,255,0.5)", marginRight: 18,
            }}>
              {l.label}
            </span>
            <span style={{
              fontFamily: EN, fontSize: l.big ? 46 : 25, fontWeight: l.big ? 700 : 500,
              letterSpacing: l.big ? 4 : 2, color: l.big ? C.yellow : "#FFFFFF",
              textShadow: l.big ? "0 0 30px rgba(255,197,61,0.35)" : "none",
            }}>
              {l.value}
            </span>
          </div>
        );
        y += l.big ? 96 : 66;
        return row;
      })}

      <AbsoluteFill style={{ background: "#04070F", opacity: interpolate(frame, [0, 16], [1, 0], cl) }} />
      <AbsoluteFill style={{ background: "#04070F", opacity: interpolate(frame, [326, 358], [0, 1], cl) }} />
    </AbsoluteFill>
  );
};
`;

/* ---------------- write everything ---------------- */
for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log("OK " + path);
}
console.log("PROJECT GENERATED — " + Object.keys(files).length + " files. Next: npm install && npm run sfx");
