#!/usr/bin/env node
// Renders the last year of GitHub contributions as a night sky:
// every day is a star, brightness follows volume, consecutive active days
// are joined into constellations. Output: assets/constellation.svg
//
// Usage:
//   GITHUB_TOKEN=... [PROFILE_LOGIN=user] node scripts/constellation.mjs
//   node scripts/constellation.mjs --fixture data.json   (offline preview)

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "assets/constellation.svg");
const LOGIN = process.env.PROFILE_LOGIN || "gabrielmds0";

// Palette shared with the other profile panels.
const C = {
  panel: "#0d1117",
  border: "#30363d",
  dust: "#3b3150",
  line: "#8d6fd1",
  star: "#cbb2ff",
  bright: "#f2eafb",
  accent: "#b693f9",
  text: "#dbd6e3",
  muted: "#9d93ad",
};

async function fetchCalendar(login) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error("Set GITHUB_TOKEN (or use --fixture <file>).");
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
    totalContributions weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-constellation" },
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar;
}

async function loadCalendar() {
  const i = process.argv.indexOf("--fixture");
  if (i > -1) return JSON.parse(await readFile(process.argv[i + 1], "utf8"));
  return fetchCalendar(LOGIN);
}

// Quartile levels over active days, mirroring GitHub's own bucketing.
function levelsFor(counts) {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => active[Math.min(active.length - 1, Math.floor(p * active.length))] ?? 1;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  return (c) => (c <= 0 ? 0 : c <= q1 ? 1 : c <= q2 ? 2 : c <= q3 ? 3 : 4);
}

function stats(days) {
  let longest = 0, run = 0, best = days[0];
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
    if (d.count > best.count) best = d;
  }
  // Current streak forgives an empty "today" (the day is not over yet).
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) current++;
    else if (i === days.length - 1) continue;
    else break;
  }
  return { longest, current, best, active: days.filter((d) => d.count > 0).length };
}

// Deterministic jitter so stars sit off-grid like a real sky, stable between runs.
function jitter(date, salt) {
  let h = 2166136261 ^ salt;
  for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

const fmt = (n) => n.toLocaleString("en-US");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function render(cal) {
  const W = 1200, H = 440;
  const padX = 56, top = 74, cell = (W - padX * 2) / cal.weeks.length, rowH = 30;

  const days = [];
  cal.weeks.forEach((w, wi) =>
    w.contributionDays.forEach((d) => {
      const wd = new Date(d.date + "T00:00:00Z").getUTCDay();
      days.push({
        date: d.date,
        count: d.contributionCount,
        x: padX + cell * (wi + 0.5) + jitter(d.date, 1) * cell * 0.5,
        y: top + rowH * (wd + 0.5) + jitter(d.date, 2) * rowH * 0.42,
        wi,
        wd,
      });
    }),
  );
  const level = levelsFor(days.map((d) => d.count));
  days.forEach((d) => (d.level = level(d.count)));
  const s = stats(days);

  // Nebula sits behind the densest four-week stretch.
  const weekly = cal.weeks.map((w) => w.contributionDays.reduce((a, d) => a + d.contributionCount, 0));
  let peak = 0, peakSum = -1;
  for (let i = 0; i + 4 <= weekly.length; i++) {
    const sum = weekly.slice(i, i + 4).reduce((a, b) => a + b, 0);
    if (sum > peakSum) (peakSum = sum), (peak = i + 2);
  }
  const nebulaX = padX + cell * peak;

  // Constellation lines: consecutive active days, plus same-weekday neighbours
  // when both nights are bright enough to read as a shape.
  const lines = [];
  for (let i = 1; i < days.length; i++) {
    const a = days[i - 1], b = days[i];
    if (a.level && b.level && b.wi === a.wi) lines.push([a, b, Math.min(a.level, b.level)]);
  }
  const byPos = new Map(days.map((d) => [`${d.wi}:${d.wd}`, d]));
  for (const d of days) {
    const n = byPos.get(`${d.wi + 1}:${d.wd}`);
    if (n && d.level >= 2 && n.level >= 2) lines.push([d, n, Math.min(d.level, n.level)]);
  }

  const r = [0.9, 1.5, 2.1, 2.8, 3.4];
  const op = [0.55, 0.62, 0.78, 0.92, 1];
  const fill = [C.dust, C.accent, C.star, C.star, C.bright];

  const sparkle = (x, y, k) =>
    `<path d="M${x} ${y - k}Q${x} ${y} ${x + k} ${y}Q${x} ${y} ${x} ${y + k}Q${x} ${y} ${x - k} ${y}Q${x} ${y} ${x} ${y - k}Z" fill="${C.bright}"/>`;

  let twinkle = 0;
  const stars = days
    .map((d) => {
      const x = d.x.toFixed(1), y = d.y.toFixed(1);
      const title = `<title>${d.date}: ${d.count} contribution${d.count === 1 ? "" : "s"}</title>`;
      if (d.level === 4) {
        const delay = ((twinkle++ * 0.73) % 6).toFixed(2);
        return `<g class="tw" style="animation-delay:${delay}s">${title}<circle cx="${x}" cy="${y}" r="9" fill="url(#halo)"/>${sparkle(+x, +y, 7)}<circle cx="${x}" cy="${y}" r="${r[4]}" fill="${C.bright}"/></g>`;
      }
      const glow = d.level === 3 ? `<circle cx="${x}" cy="${y}" r="6" fill="url(#halo)" opacity=".7"/>` : "";
      return `<g>${title}${glow}<circle cx="${x}" cy="${y}" r="${r[d.level]}" fill="${fill[d.level]}" opacity="${op[d.level]}"/></g>`;
    })
    .join("");

  const lineSvg = lines
    .map(([a, b, l]) => `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke-opacity="${(0.2 + l * 0.09).toFixed(2)}"/>`)
    .join("");

  // Month ticks where a new month starts in a week's first day.
  let lastMonth = -1;
  const months = cal.weeks
    .map((w, wi) => {
      const m = new Date(w.contributionDays[0].date + "T00:00:00Z").getUTCMonth();
      if (m === lastMonth || wi > cal.weeks.length - 2) return "";
      lastMonth = m;
      const x = (padX + cell * wi + cell * 0.5).toFixed(1);
      return `<line x1="${x}" y1="${top + rowH * 7 + 14}" x2="${x}" y2="${top + rowH * 7 + 20}" stroke="${C.border}"/><text x="${x}" y="${top + rowH * 7 + 36}">${MONTHS[m]}</text>`;
    })
    .join("");

  const first = days[0].date, last = days[days.length - 1].date;
  const bestDate = new Date(s.best.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const bestShort = new Date(s.best.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const facts = [
    [fmt(cal.totalContributions), "contributions"],
    [fmt(s.active), "active days"],
    [plural(s.longest, "day"), "longest streak"],
    [fmt(s.best.count), `best day · ${bestShort}`],
  ];
  const colW = (W - padX * 2) / facts.length;
  const factSvg = facts
    .map(([v, l], i) => `<text class="v" x="${(padX + colW * i).toFixed(1)}" y="${H - 50}">${v}</text><text class="l" x="${(padX + colW * i).toFixed(1)}" y="${H - 22}">${l.toUpperCase()}</text>`)
    .join("");

  const summary = `${fmt(cal.totalContributions)} contributions from ${first} to ${last}: ${s.active} active days, longest streak ${plural(s.longest, "day")}, best day ${bestDate} with ${s.best.count}.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">Contribution sky of ${LOGIN}</title>
<desc id="d">${summary}</desc>
<defs>
<radialGradient id="halo"><stop offset="0" stop-color="${C.star}" stop-opacity=".55"/><stop offset="1" stop-color="${C.star}" stop-opacity="0"/></radialGradient>
<radialGradient id="nebula" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5b3fa0" stop-opacity=".28"/><stop offset=".55" stop-color="#3a2a68" stop-opacity=".1"/><stop offset="1" stop-color="#0d1117" stop-opacity="0"/></radialGradient>
<linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1117"/><stop offset="1" stop-color="#140f22"/></linearGradient>
<clipPath id="panel"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12"/></clipPath>
</defs>
<style>
text{font-family:Inter,"Segoe UI",Arial,sans-serif}
.m text{fill:${C.muted};font-size:13px;letter-spacing:.16em;text-anchor:middle}
.f .v{fill:${C.bright};font-size:30px;font-weight:600;font-variant-numeric:tabular-nums}
.f .l{fill:${C.muted};font-size:14px;letter-spacing:.14em}
.k{fill:${C.muted};font-size:13px;letter-spacing:.22em}
.c line{stroke:${C.line};stroke-width:.8}
.tw{animation:tw 6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.45}}
@media (prefers-reduced-motion:reduce){.tw{animation:none}}
</style>
<g clip-path="url(#panel)">
<rect width="${W}" height="${H}" fill="url(#dusk)"/>
<ellipse cx="${nebulaX.toFixed(1)}" cy="${top + rowH * 3.5}" rx="260" ry="150" fill="url(#nebula)"/>
<g transform="translate(${W - 74} 38)"><circle r="13" fill="none" stroke="${C.border}"/><path d="M4-12.4A13 13 0 1 0 4 12.4A10 10 0 1 1 4-12.4Z" fill="${C.star}" opacity=".85"/></g>
</g>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="none" stroke="${C.border}" stroke-width="1.2"/>
<text class="k" x="${padX}" y="44">${first.replaceAll("-", ".")} — ${last.replaceAll("-", ".")}</text>
<g class="c">${lineSvg}</g>
<g>${stars}</g>
<g class="m">${months}</g>
<line x1="${padX}" y1="${H - 100}" x2="${W - padX}" y2="${H - 100}" stroke="${C.border}"/>
<g class="f">${factSvg}</g>
</svg>
`;
}

const cal = await loadCalendar();
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, render(cal));
console.log(`constellation.svg written (${cal.totalContributions} contributions)`);
