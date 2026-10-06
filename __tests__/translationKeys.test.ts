import { translations } from "@/lib/i18n/translations";

/**
 * Kap tekstet e papërkthyera para se të dalin te telefoni (si "baby_blood_type" në vend të "Grupi i gjakut").
 *
 * TypeScript-i i kontrollon thirrjet `t("...")` vetëm kur çelësi shkruhet drejt; çelësat që kalojnë nëpër
 * katalogë (`labelKey: "..."`) ose me `as never` i shpëtojnë. Ky test lexon kodin dhe kërkon çdo çelës të shkruar
 * si tekst, dhe kontrollon që ekziston në shqip dhe në anglisht.
 */

// Jest ka Node, por tsconfig-u i app-it s'ka tipet e Node-it: deklarohet vetëm ç'përdoret këtu.
declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as {
  readdirSync(dir: string, opts: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: string, enc: string): string;
};

const ROOT = `${__dirname}/..`;
const DIRS = ["app", "components", "lib"];

function walk(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !p.includes("/lib/i18n/translations.ts")) out.push(p);
  }
}

const files: string[] = [];
for (const d of DIRS) walk(`${ROOT}/${d}`, files);

/** Çelësat e shkruar si tekst: t("x"), t('x'), labelKey: "x", subKey: "x", labelKey="x". */
const PATTERNS = [
  /\bt\(\s*["']([a-z][a-z0-9_]*)["']/g,
  /\b(?:labelKey|subKey|titleKey|hintKey|bodyKey)\s*[:=]\s*["']([a-z][a-z0-9_]*)["']/g,
];

type Use = { key: string; file: string };
const uses: Use[] = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const re of PATTERNS) {
    for (const m of src.matchAll(re)) uses.push({ key: m[1], file: file.slice(ROOT.length + 1) });
  }
}

const sq = translations.sq as Record<string, string>;
const en = translations.en as Record<string, string>;

describe("përkthimet", () => {
  it("gjen çelësa në kod (testi lexon vërtet skedarët)", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(uses.length).toBeGreaterThan(200);
  });

  it("çdo çelës i përdorur në kod ekziston në shqip", () => {
    const missing = [...new Set(uses.filter((u) => !(u.key in sq)).map((u) => `${u.key}  (${u.file})`))];
    expect(missing).toEqual([]);
  });

  it("çdo çelës i përdorur në kod ekziston në anglisht", () => {
    const missing = [...new Set(uses.filter((u) => !(u.key in en)).map((u) => `${u.key}  (${u.file})`))];
    expect(missing).toEqual([]);
  });

  it("anglishtja ka të gjithë çelësat e shqipes", () => {
    expect(Object.keys(sq).filter((k) => !(k in en))).toEqual([]);
  });

  it("asnjë përkthim bosh", () => {
    const empty = [
      ...Object.entries(sq).filter(([, v]) => !String(v).trim()).map(([k]) => `sq:${k}`),
      ...Object.entries(en).filter(([, v]) => !String(v).trim()).map(([k]) => `en:${k}`),
    ];
    expect(empty).toEqual([]);
  });
});
