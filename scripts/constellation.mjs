#!/usr/bin/env node
// Renders the last year of GitHub contributions as a night sky laid on the
// contribution calendar grid: every day is a star, brightness follows volume,
// the longest streak is drawn as a named constellation and the best day is ringed.
//
// Usage:
//   GITHUB_TOKEN=... [PROFILE_LOGIN=user] node scripts/constellation.mjs
//   node scripts/constellation.mjs --fixture calendar.json   (offline preview)

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ROOT, SANS, fontCss, sparkle } from "./theme.mjs";

const OUT = resolve(ROOT, "assets/constellation.svg");
const LOGIN = process.env.PROFILE_LOGIN || "gabrielmds0";

// The sky stays dark in both GitHub themes: it is a window, like the banner.
const C = {
  top: "#0d1117",
  bottom: "#150f24",
  border: "#30363d",
  dust: "#3d3355",
  dim: "#9b7fe0",
  star: "#d9c8ff",
  bright: "#f7f2ff",
  accent: "#b693f9",
  text: "#e6def3",
  muted: "#968cab",
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

// All runs of consecutive active days, longest first (latest wins ties).
function streaks(days) {
  const runs = [];
  let cur = [];
  for (const d of days) {
    if (d.count > 0) cur.push(d);
    else if (cur.length) runs.push(cur), (cur = []);
  }
  if (cur.length) runs.push(cur);
  return runs.sort((a, b) => b.length - a.length || (a[0].date < b[0].date ? 1 : -1));
}

const fmt = (n) => n.toLocaleString("en-US");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const short = (date) => {
  const d = new Date(date + "T00:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

// Comb-shaped figure: each week's run hangs from a rail joining the weeks.
function figurePath(run) {
  const segs = [];
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1], b = run[i];
    if (a.wi === b.wi) segs.push([a, b]);
  }
  const weeks = [...new Set(run.map((d) => d.wi))];
  for (let i = 1; i < weeks.length; i++) {
    const prev = run.filter((d) => d.wi === weeks[i - 1]);
    const next = run.filter((d) => d.wi === weeks[i]);
    segs.push([prev[0], next[0]]);
  }
  return segs.map(([a, b]) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`).join("");
}

function render(cal) {
  const W = 1000, H = 470;
  const left = 84, right = 36, top = 122, rowH = 24;
  const cell = (W - left - right) / cal.weeks.length;
  const gridBottom = top + rowH * 7;

  const days = [];
  cal.weeks.forEach((w, wi) =>
    w.contributionDays.forEach((d) => {
      const wd = new Date(d.date + "T00:00:00Z").getUTCDay();
      days.push({ date: d.date, count: d.contributionCount, wi, wd, x: left + cell * (wi + 0.5), y: top + rowH * (wd + 0.5) });
    }),
  );
  const level = levelsFor(days.map((d) => d.count));
  days.forEach((d) => (d.level = level(d.count)));

  const runs = streaks(days);
  const longest = runs[0] ?? [];
  const inLongest = new Set(longest);
  const best = days.reduce((m, d) => (d.count > m.count ? d : m), days[0]);
  const active = days.filter((d) => d.count > 0).length;

  // Faint figures for every other streak of 4+ days; the longest one is drawn bright.
  const minor = runs.slice(1).filter((r) => r.length >= 4).map(figurePath).join("");
  const major = longest.length > 1 ? figurePath(longest) : "";

  let tw = 0;
  const stars = days
    .map((d) => {
      const x = d.x.toFixed(1), y = d.y.toFixed(1);
      const title = `<title>${short(d.date)}: ${d.count} contribution${d.count === 1 ? "" : "s"}</title>`;
      const boost = inLongest.has(d) ? 1 : 0.82;
      switch (d.level) {
        case 0:
          return `<circle cx="${x}" cy="${y}" r="1.3" fill="${C.dust}">${title}</circle>`;
        case 1:
          return `<circle cx="${x}" cy="${y}" r="2.3" fill="${C.dim}" opacity="${boost}">${title}</circle>`;
        case 2:
          return `<circle cx="${x}" cy="${y}" r="3.1" fill="${C.star}" opacity="${boost}">${title}</circle>`;
        case 3:
          return `<g opacity="${boost}">${title}<circle cx="${x}" cy="${y}" r="8" fill="url(#halo)"/><circle cx="${x}" cy="${y}" r="3.8" fill="${C.star}"/></g>`;
        default: {
          const delay = ((tw++ * 0.73) % 6).toFixed(2);
          return `<g class="tw" style="animation-delay:${delay}s">${title}<circle cx="${x}" cy="${y}" r="11" fill="url(#halo)"/>${sparkle(+x, +y, 8.5, C.bright)}</g>`;
        }
      }
    })
    .join("");

  // Annotation for the longest streak, placed above the grid and kept inside the panel.
  let note = "";
  if (longest.length > 1) {
    const midX = (longest[0].x + longest[longest.length - 1].x) / 2;
    const topY = Math.min(...longest.map((d) => d.y)) - 10;
    const anchorEnd = midX > W - 260;
    const anchorStart = midX < left + 160;
    const tx = anchorEnd ? midX + 6 : anchorStart ? midX - 6 : midX;
    const anchor = anchorEnd ? "end" : anchorStart ? "start" : "middle";
    note = `<path d="M${midX.toFixed(1)} 92V${topY.toFixed(1)}" stroke="${C.accent}" stroke-opacity=".55" stroke-dasharray="2 3"/>
<text class="na" x="${tx.toFixed(1)}" y="66" text-anchor="${anchor}">LONGEST STREAK · ${longest.length} DAYS</text>
<text class="nb" x="${tx.toFixed(1)}" y="84" text-anchor="${anchor}">${short(longest[0].date)} – ${short(longest[longest.length - 1].date)}</text>`;
  }

  const ring = best.count
    ? `<circle cx="${best.x.toFixed(1)}" cy="${best.y.toFixed(1)}" r="13" fill="none" stroke="${C.accent}" stroke-width="1.2"/>`
    : "";

  const weekdays = [[1, "MON"], [3, "WED"], [5, "FRI"]]
    .map(([r, l]) => `<text class="wd" x="${left - 18}" y="${(top + rowH * (r + 0.5) + 4).toFixed(1)}">${l}</text>`)
    .join("");

  let lastMonth = -1;
  const months = cal.weeks
    .map((w, wi) => {
      const m = new Date(w.contributionDays[0].date + "T00:00:00Z").getUTCMonth();
      if (m === lastMonth || wi > cal.weeks.length - 2) return "";
      lastMonth = m;
      return `<text class="mo" x="${(left + cell * wi + 2).toFixed(1)}" y="${gridBottom + 30}">${MONTHS[m]}</text>`;
    })
    .join("");

  // Legend: the same marks the sky uses, smallest to brightest.
  // Sits on whichever side the streak note leaves free.
  const noteX = longest.length > 1 ? (longest[0].x + longest[longest.length - 1].x) / 2 : 0;
  const legendLeft = noteX > W / 2;
  const lx = legendLeft ? 44 : W - right - 200, ly = 86;
  const legend = `<text class="lg" x="${lx}" y="${ly + 4}">LESS</text>
<circle cx="${lx + 54}" cy="${ly}" r="1.3" fill="${C.dust}"/><circle cx="${lx + 74}" cy="${ly}" r="2.3" fill="${C.dim}"/>
<circle cx="${lx + 96}" cy="${ly}" r="3.1" fill="${C.star}"/><circle cx="${lx + 120}" cy="${ly}" r="3.8" fill="${C.star}"/>
${sparkle(lx + 146, ly, 8.5, C.bright)}<text class="lg" x="${lx + 166}" y="${ly + 4}">MORE</text>`;

  const first = days[0].date, last = days[days.length - 1].date;
  const facts = [
    [fmt(cal.totalContributions), "CONTRIBUTIONS"],
    [fmt(active), "ACTIVE DAYS"],
    [`${longest.length} day${longest.length === 1 ? "" : "s"}`, "LONGEST STREAK"],
    [fmt(best.count), `BEST DAY · ${short(best.date)}`],
  ];
  const colW = (W - 88) / facts.length;
  const factY = H - 58;
  const factSvg = facts
    .map(([v, l], i) => {
      const x = 44 + colW * i;
      const glyph = i === 3 ? `<circle cx="${x + 5}" cy="${factY + 24}" r="5" fill="none" stroke="${C.accent}" stroke-width="1.2"/>` : "";
      return `<text class="v" x="${x}" y="${factY}">${v}</text>${glyph}<text class="l" x="${x + (i === 3 ? 16 : 0)}" y="${factY + 29}">${l}</text>`;
    })
    .join("");

  const summary = `${fmt(cal.totalContributions)} contributions between ${short(first)} ${first.slice(0, 4)} and ${short(last)} ${last.slice(0, 4)}, on ${active} active days. Longest streak: ${longest.length} days. Best day: ${short(best.date)} with ${best.count} contributions.`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">Contribution sky of ${LOGIN}</title>
<desc id="d">${summary}</desc>
<defs>
<radialGradient id="halo"><stop offset="0" stop-color="${C.star}" stop-opacity=".5"/><stop offset="1" stop-color="${C.star}" stop-opacity="0"/></radialGradient>
<linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.top}"/><stop offset="1" stop-color="${C.bottom}"/></linearGradient>
</defs>
<style>${fontCss("sans")}
text{font-family:${SANS}}
.wd,.mo,.lg{fill:${C.muted};font-size:14px;letter-spacing:.12em}
.wd{text-anchor:end}
.na{fill:${C.text};font-size:16px;font-weight:500;letter-spacing:.16em}
.nb{fill:${C.muted};font-size:14px;letter-spacing:.12em}
.rg{fill:${C.muted};font-size:14px;letter-spacing:.16em}
.v{fill:${C.bright};font-size:36px;font-weight:500;font-variant-numeric:tabular-nums}
.l{fill:${C.muted};font-size:14px;letter-spacing:.12em}
.tw{animation:tw 6s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.tw{animation:none}}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="url(#dusk)" stroke="${C.border}"/>
<text class="rg" x="44" y="64">${short(first)} ${first.slice(0, 4)} — ${short(last)} ${last.slice(0, 4)}</text>
${legend}
${note}
${weekdays}
<path d="${minor}" fill="none" stroke="${C.accent}" stroke-opacity=".22" stroke-width="1"/>
<path d="${major}" fill="none" stroke="${C.accent}" stroke-opacity=".75" stroke-width="1.4"/>
${stars}
${ring}
${months}
<line x1="44" y1="${H - 118}" x2="${W - 44}" y2="${H - 118}" stroke="${C.border}"/>
${factSvg}
</svg>
`;
  return { svg, summary };
}

const cal = await loadCalendar();
await mkdir(dirname(OUT), { recursive: true });
const { svg, summary } = render(cal);
await writeFile(OUT, svg);

// Keep the README's alt text in step with the drawing for screen readers.
const README = resolve(ROOT, "README.md");
const readme = await readFile(README, "utf8");
const alt = `Contribution sky, a night-sky drawing of the contribution calendar: ${summary}`.replace(/"/g, "&quot;");
const next = readme.replace(/(<!-- sky:start -->)[\s\S]*?(<!-- sky:end -->)/, `$1<img src="./assets/constellation.svg" width="100%" alt="${alt}" />$2`);
if (next !== readme) await writeFile(README, next);
console.log(`constellation.svg written (${cal.totalContributions} contributions)`);
