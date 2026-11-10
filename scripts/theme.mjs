// Shared tokens for every SVG drawn into the profile README.
// GitHub renders README SVGs as <img>: no external fonts, no page CSS,
// so fonts are embedded as data URIs and each panel ships a light and dark file.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const font = (file) => readFileSync(resolve(ROOT, "scripts/fonts", file)).toString("base64");
const FACES = {
  sans: `@font-face{font-family:"Sora";font-weight:300 700;src:url(data:font/woff2;base64,${font("sora.woff2")}) format("woff2")}`,
};
export const fontCss = (...which) => which.map((w) => FACES[w]).join("");

export const SANS = `Sora,"Segoe UI",Helvetica,Arial,sans-serif`;

// Matched to GitHub's own surfaces so panels sit on the page instead of on a slab.
export const THEMES = {
  dark: {
    border: "#30363d",
    wash: "#8957e5",
    title: "#f0e9fb",
    body: "#c9c1d6",
    muted: "#8e86a0",
    accent: "#b693f9",
    icon: "#c4a8ff",
    star: "#e4d7ff",
    line: "#b693f9",
  },
  light: {
    border: "#d0d7de",
    wash: "#8250df",
    title: "#1f1630",
    body: "#4b4359",
    muted: "#6e6680",
    accent: "#6f42c1",
    icon: "#7a4fd0",
    star: "#6f42c1",
    line: "#8250df",
  },
};

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// FNV-1a hash → deterministic pseudo-random stream per string.
export function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Four-point star, the banner's portal motif.
export const sparkle = (x, y, k, fill) =>
  `<path d="M${x} ${y - k}Q${x} ${y} ${x + k} ${y}Q${x} ${y} ${x} ${y + k}Q${x} ${y} ${x - k} ${y}Q${x} ${y} ${x} ${y - k}Z" fill="${fill}"/>`;
