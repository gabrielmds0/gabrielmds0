#!/usr/bin/env node
// Builds the static README panels in light and dark:
// project cards, toolkit, section horizons, footer and the star bullet.
// Run: node scripts/build-profile.mjs
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, THEMES, SANS, fontCss, esc, rng, sparkle } from "./theme.mjs";

const OUT = resolve(ROOT, "assets/profile");
// Brand marks from Simple Icons (CC0), 24×24 paths keyed by toolkit name.
const ICONS = JSON.parse(readFileSync(resolve(ROOT, "scripts/icons.json"), "utf8"));
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

const W = 840;
const f = (n) => n.toFixed(1);

// Motion never hides content: every frame-zero state is the finished drawing,
// so viewers that rasterize SVGs without animating still see everything.
// Bright stars breathe; one meteor crosses the opening horizon.
const motion = `
.tw{animation:tw 5.5s ease-in-out infinite}
.mt{opacity:0;animation:mt 11s cubic-bezier(.16,1,.3,1) 2s infinite}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes mt{0%{opacity:0;transform:translate(0,0)}2%{opacity:1}12%{opacity:0;transform:translate(260px,26px)}100%{opacity:0;transform:translate(260px,26px)}}
@media (prefers-reduced-motion:reduce){.tw,.mt{animation:none}}`;

function wrap(text, max) {
  const lines = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if ((cur + " " + word).trim().length > max) lines.push(cur), (cur = word);
    else cur = (cur + " " + word).trim();
  }
  return [...lines, cur];
}

// Faint background stars; a handful breathe at different tempos.
// `clear` lists boxes kept free of stars so text stays clean.
function starfield(seed, t, w, h, n, mode, clear = []) {
  const r = rng(seed + ":field");
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = 8 + r() * (w - 16), y = 8 + r() * (h - 16);
    const size = 0.5 + r() * r() * 1.3;
    const o = (mode === "dark" ? 0.18 : 0.14) + r() * (mode === "dark" ? 0.38 : 0.26);
    if (clear.some((b) => x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6)) continue;
    const breathe = r() < 0.14 ? ` class="tw" style="animation-delay:${f(r() * 5)}s;animation-duration:${f(4 + r() * 4)}s"` : "";
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(size)}" fill="${t.star}" opacity="${o.toFixed(2)}"${breathe}/>`;
  }
  return out;
}

// A small named constellation, seeded by its id, drawn in on load.
function figure(seed, t, box, count = 6) {
  const r = rng(seed);
  const pts = Array.from({ length: count }, (_, i) => ({
    x: box.x + (box.w * (i + 0.2 + r() * 0.6)) / count,
    y: box.y + box.h * (0.12 + r() * 0.76),
    s: r(),
  }));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${f(p.x)} ${f(p.y)}`).join("");
  const brightest = pts.reduce((m, p) => (p.s > m.s ? p : m));
  const stars = pts
    .map((p, i) => {
      if (p === brightest)
        return `<g><circle cx="${f(p.x)}" cy="${f(p.y)}" r="12" fill="url(#halo)"/><g class="tw" style="animation-delay:3s">${sparkle(+f(p.x), +f(p.y), 8, t.star)}</g></g>`;
      return `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(1.5 + p.s * 1.7)}" fill="${t.star}"/>`;
    })
    .join("");
  return `<path d="${d}" fill="none" stroke="${t.line}" stroke-opacity=".45" stroke-width="1"/>${stars}`;
}

const halo = (t, mode) =>
  `<radialGradient id="halo"><stop offset="0" stop-color="${t.star}" stop-opacity="${mode === "dark" ? 0.45 : 0.25}"/><stop offset="1" stop-color="${t.star}" stop-opacity="0"/></radialGradient>`;

function card(p, mode) {
  const t = THEMES[mode];
  const H = 200;
  const lines = wrap(p.text, 50);
  if (lines.length > 2) throw new Error(`${p.name}: description must fit two lines`);
  const desc = lines.map((l, i) => `<text class="d" x="36" y="${100 + i * 28}">${esc(l)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${p.name}: ${p.text} Built with ${p.stack.join(", ")}.`)}">
<defs>${halo(t, mode)}<radialGradient id="w" cx="1" cy=".5" r=".6"><stop offset="0" stop-color="${t.wash}" stop-opacity="${mode === "dark" ? 0.2 : 0.09}"/><stop offset="1" stop-color="${t.wash}" stop-opacity="0"/></radialGradient>
<clipPath id="c"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14"/></clipPath></defs>
<style>${fontCss("sans")}
text{font-family:${SANS}}
.n{font-weight:600;font-size:27px;letter-spacing:-.01em;fill:${t.title}}
.d{font-weight:300;font-size:17.5px;fill:${t.body}}
.s{font-weight:500;font-size:12.5px;letter-spacing:.2em;fill:${t.accent}}${motion}
</style>
<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="url(#w)"/>${starfield(p.slug, t, W, H, 60, mode, [{ x: 30, y: 28, w: 520, h: H - 50 }])}</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${t.border}"/>
<text class="n" x="35" y="58">${esc(p.name)}</text>
${desc}
<text class="s" x="36" y="${H - 32}">${esc(p.stack.join("  ·  ").toUpperCase())}</text>
${figure(p.slug, t, { x: 600, y: 36, w: 170, h: 128 })}
<path d="M${W - 52} 48L${W - 34} 30M${W - 46} 30H${W - 34}V42" fill="none" stroke="${t.accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}

function toolkit(mode) {
  const t = THEMES[mode];
  const colW = (W - 72) / TOOLKIT.length;
  const rows = Math.max(...TOOLKIT.map(([, items]) => items.length));
  const H = 84 + rows * 34 + 22;
  const cols = TOOLKIT.map(([label, items], i) => {
    const x = 36 + colW * i;
    const names = items
      .map((name, j) => {
        const y = 94 + j * 34;
        if (!ICONS[name]) throw new Error(`No icon for ${name}`);
        return `<path transform="translate(${x} ${y - 15}) scale(.75)" d="${ICONS[name]}" fill="${t.icon}"/><text class="i" x="${x + 28}" y="${y}">${esc(name)}</text>`;
      })
      .join("");
    const tick = i ? `<line x1="${x - 18}" y1="34" x2="${x - 18}" y2="${H - 26}" stroke="${t.border}"/>` : "";
    return `${tick}${sparkle(x + 4, 44, 5, t.accent)}<text class="l" x="${x + 16}" y="49">${esc(label.toUpperCase())}</text>${names}`;
  }).join("");
  const alt = TOOLKIT.map(([l, items]) => `${l}: ${items.join(", ")}`).join(". ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Toolkit. ${alt}.`)}">
<defs><clipPath id="c"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14"/></clipPath></defs>
<style>${fontCss("sans")}
text{font-family:${SANS}}
.l{font-weight:500;font-size:12.5px;letter-spacing:.2em;fill:${t.accent}}
.i{font-weight:400;font-size:19px;fill:${t.title}}${motion}
</style>
<g clip-path="url(#c)">${starfield("toolkit", t, W, H, 40, mode, TOOLKIT.map(([, items], i) => ({ x: 36 + colW * i, y: 30, w: 176, h: 70 + items.length * 34 })))}</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${t.border}"/>
${cols}
</svg>
`;
}

// Horizon between chapters: a fading meridian with a short constellation riding it.
function horizon(name, mode) {
  const t = THEMES[mode];
  const H = 64, mid = 32;
  const r = rng("horizon:" + name);
  const cx = 300 + r() * 240;
  const pts = [-90, -46, 0, 52, 98].map((dx, i) => ({ x: cx + dx + (r() - 0.5) * 16, y: mid + (i === 2 ? 0 : (r() - 0.5) * 30) }));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${f(p.x)} ${f(p.y)}`).join("");
  const stars = pts
    .map((p, i) =>
      i === 2
        ? `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="12" fill="url(#halo)"/><g class="tw">${sparkle(+f(p.x), +f(p.y), 7, t.star)}</g>`
        : `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(1.4 + r() * 1.2)}" fill="${t.star}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
<defs>${halo(t, mode)}<linearGradient id="m" x1="0" x2="1"><stop offset="0" stop-color="${t.line}" stop-opacity="0"/><stop offset=".5" stop-color="${t.line}" stop-opacity=".5"/><stop offset="1" stop-color="${t.line}" stop-opacity="0"/></linearGradient><linearGradient id="tail" x1="0" x2="1"><stop offset="0" stop-color="${t.star}" stop-opacity="0"/><stop offset="1" stop-color="${t.star}"/></linearGradient></defs>
<style>${motion}</style>
${starfield("horizon:" + name, t, W, H, 26, mode)}
<line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="url(#m)"/>
${name === "intro" ? `<g class="mt"><line x1="120" y1="10" x2="168" y2="15" stroke="url(#tail)" stroke-width="1.2" stroke-linecap="round"/><circle cx="168" cy="15" r="1.4" fill="${t.star}"/></g>` : ""}
<path d="${d}" fill="none" stroke="${t.line}" stroke-opacity=".5"/>
${stars}
</svg>
`;
}

function footer(mode) {
  const t = THEMES[mode];
  const H = 170;
  const motto = "CURIOSITY  ·  DISCIPLINE  ·  ITERATION";
  // An arc of stars rising over the motto, like the banner's portal.
  const arc = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI * (0.12 + (0.76 * i) / 8);
    return { x: W / 2 - Math.cos(a) * 250, y: 112 - Math.sin(a) * 74 };
  });
  const d = arc.map((p, i) => `${i ? "L" : "M"}${f(p.x)} ${f(p.y)}`).join("");
  const stars = arc
    .map((p, i) =>
      i === 4
        ? `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="16" fill="url(#halo)"/><g class="tw">${sparkle(+f(p.x), +f(p.y), 10, t.star)}</g>`
        : `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${i % 3 ? 1.8 : 2.6}" fill="${t.star}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Curiosity, discipline, and iteration.">
<defs>${halo(t, mode)}</defs>
<style>${fontCss("sans")}
text{font-family:${SANS};font-weight:400;font-size:15px;letter-spacing:.32em;fill:${t.body};text-anchor:middle}${motion}
</style>
${starfield("footer", t, W, H, 40, mode, [{ x: 200, y: 128, w: 440, h: 26 }])}
<path d="${d}" fill="none" stroke="${t.line}" stroke-opacity=".4"/>
${stars}
<text x="${W / 2}" y="146">${motto}</text>
</svg>
`;
}

// Mid-violet so the bullet reads on both GitHub themes.
const bullet = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${sparkle(8, 8, 7, "#9a6cf0")}</svg>
`;

for (const mode of ["dark", "light"]) {
  for (const p of PROJECTS) writeFileSync(resolve(OUT, `${p.slug}-${mode}.svg`), card(p, mode));
  writeFileSync(resolve(OUT, `toolkit-${mode}.svg`), toolkit(mode));
  for (const name of ["intro", "sky"]) writeFileSync(resolve(OUT, `horizon-${name}-${mode}.svg`), horizon(name, mode));
  writeFileSync(resolve(OUT, `footer-${mode}.svg`), footer(mode));
}
writeFileSync(resolve(OUT, "star.svg"), bullet);
console.log(`profile panels written to ${OUT}`);
