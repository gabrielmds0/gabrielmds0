#!/usr/bin/env node
// Builds the static README panels (project cards, toolkit) in light and dark.
// Run: node scripts/build-profile.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, THEMES, SANS, SERIF, fontCss, esc, rng, sparkle } from "./theme.mjs";

const OUT = resolve(ROOT, "assets/profile");
mkdirSync(OUT, { recursive: true });

const PROJECTS = [
  {
    slug: "furia-fan-chat",
    name: "FURIA Fan Chat",
    text: "Conversational esports interface with simulated chat, match information, team profiles and news.",
    stack: ["React", "Vite", "Tailwind CSS"],
  },
  {
    slug: "furia-know-your-fan",
    name: "FURIA Know Your Fan",
    text: "Fan registration with validation, document uploads and Firebase integration.",
    stack: ["React", "Firebase", "Vite"],
  },
  {
    slug: "amazon-scraper",
    name: "Amazon Product Scraper",
    text: "Full-stack product search experiment with organized titles, ratings, reviews and images.",
    stack: ["TypeScript", "Bun", "Express"],
  },
];

const TOOLKIT = [
  ["Languages", ["TypeScript", "JavaScript", "Python"]],
  ["Frontend", ["React", "Next.js", "Tailwind CSS"]],
  ["Backend", ["Node.js", "NestJS", "REST APIs"]],
  ["Data & infra", ["PostgreSQL", "Prisma", "Google Cloud", "n8n"]],
];

function wrap(text, max) {
  const lines = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if ((cur + " " + word).trim().length > max) lines.push(cur), (cur = word);
    else cur = (cur + " " + word).trim();
  }
  return [...lines, cur];
}

// Each project gets its own small constellation, seeded by its name.
function figure(seed, t, box) {
  const r = rng(seed);
  const n = 6;
  const pts = Array.from({ length: n }, (_, i) => ({
    x: box.x + (box.w * (i + 0.2 + r() * 0.6)) / n,
    y: box.y + box.h * (0.12 + r() * 0.76),
    s: r(),
  }));
  const chain = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
  const brightest = pts.reduce((m, p) => (p.s > m.s ? p : m));
  const stars = pts
    .map((p) =>
      p === brightest
        ? sparkle(+p.x.toFixed(1), +p.y.toFixed(1), 8, t.star)
        : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(1.6 + p.s * 1.8).toFixed(1)}" fill="${t.star}"/>`,
    )
    .join("");
  return `<path d="${chain}" fill="none" stroke="${t.line}" stroke-opacity=".38" stroke-width="1"/>${stars}`;
}

function card(p, mode) {
  const t = THEMES[mode];
  const W = 840, H = 204;
  const lines = wrap(p.text, 54);
  if (lines.length > 2) throw new Error(`${p.name}: description must fit two lines`);
  const desc = lines
    .map((l, i) => `<text class="d" x="36" y="${104 + i * 28}">${esc(l)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${p.name}: ${p.text} Built with ${p.stack.join(", ")}.`)}">
<defs><radialGradient id="w" cx="1" cy=".5" r=".55"><stop offset="0" stop-color="${t.wash}" stop-opacity="${mode === "dark" ? 0.16 : 0.08}"/><stop offset="1" stop-color="${t.wash}" stop-opacity="0"/></radialGradient></defs>
<style>${fontCss("sans", "serif")}
.n{font-family:${SERIF};font-weight:600;font-size:36px;fill:${t.title}}
.d{font-family:${SANS};font-size:20px;fill:${t.body}}
.s{font-family:${SANS};font-weight:500;font-size:14px;letter-spacing:.18em;fill:${t.accent}}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="url(#w)" stroke="${t.border}"/>
<text class="n" x="34" y="62">${esc(p.name)}</text>
${desc}
<text class="s" x="36" y="${H - 30}">${esc(p.stack.join("  ·  ").toUpperCase())}</text>
${figure(p.slug, t, { x: 600, y: 34, w: 170, h: 128 })}
<path d="M${W - 52} 48L${W - 34} 30M${W - 46} 30H${W - 34}V42" fill="none" stroke="${t.accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}

function toolkit(mode) {
  const t = THEMES[mode];
  const W = 840, colW = (W - 72) / TOOLKIT.length;
  const rows = Math.max(...TOOLKIT.map(([, items]) => items.length));
  const H = 78 + rows * 34 + 22;
  const cols = TOOLKIT.map(([label, items], i) => {
    const x = 36 + colW * i;
    const names = items.map((name, j) => `<text class="i" x="${x}" y="${88 + j * 34}">${esc(name)}</text>`).join("");
    const tick = i ? `<line x1="${x - 18}" y1="34" x2="${x - 18}" y2="${H - 26}" stroke="${t.border}"/>` : "";
    return `${tick}${sparkle(x + 4, 42, 5, t.accent)}<text class="l" x="${x + 16}" y="47">${esc(label.toUpperCase())}</text>${names}`;
  }).join("");
  const alt = TOOLKIT.map(([l, items]) => `${l}: ${items.join(", ")}`).join(". ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Toolkit. ${alt}.`)}">
<style>${fontCss("sans", "serif")}
.l{font-family:${SANS};font-weight:500;font-size:13px;letter-spacing:.18em;fill:${t.accent}}
.i{font-family:${SERIF};font-weight:600;font-size:25px;fill:${t.title}}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${t.border}"/>
${cols}
</svg>
`;
}

for (const mode of ["dark", "light"]) {
  for (const p of PROJECTS) writeFileSync(resolve(OUT, `${p.slug}-${mode}.svg`), card(p, mode));
  writeFileSync(resolve(OUT, `toolkit-${mode}.svg`), toolkit(mode));
}
console.log(`profile panels written to ${OUT}`);
