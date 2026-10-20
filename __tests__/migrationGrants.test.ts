/**
 * Nga 30 tetori 2026 Supabase s'u jep më vetë leje API-së tabelave të reja te "public": pa GRANT, app-i merr
 * "permission denied". Çdo migrim që krijon tabelë ose pamje (nga migrimet e sistemit të moshës e tutje, ato që
 * s'janë ekzekutuar ende në prodhim) duhet ta shkruajë lejen në të njëjtin skedar.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- si te backNavigation.test: pa tipet e Node në projekt */
const fs = require("fs") as { readdirSync(dir: string): string[]; readFileSync(file: string, enc: "utf8"): string };
const path = require("path") as { join(...p: string[]): string };
/* eslint-enable @typescript-eslint/no-require-imports */
declare const __dirname: string;

const DIR = path.join(__dirname, "..", "supabase", "migrations");
/** Migrimet para këtij emri janë ekzekutuar në prodhim para ndryshimit dhe i kanë lejet. */
const FIRST_CHECKED = "20261021090000";

function created(sql: string): string[] {
  const re = /create\s+(?:or\s+replace\s+)?(?:table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi;
  return [...sql.matchAll(re)].map((m) => m[1].toLowerCase());
}

function granted(sql: string): Set<string> {
  const names = new Set<string>();
  const re = /grant\s+[^;]+?\s+on\s+(?:table\s+)?([^;]+?)\s+to\s+[^;]+;/gi;
  for (const m of sql.matchAll(re)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().replace(/^public\./i, "").replace(/"/g, "").toLowerCase();
      if (name && !name.startsWith("function ") && !name.startsWith("all ")) names.add(name);
    }
  }
  return names;
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql") && f >= FIRST_CHECKED).sort();

describe("lejet e API-së te migrimet", () => {
  it("ka migrime për t'u kontrolluar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s: çdo tabelë/pamje e re ka GRANT", (file) => {
    // Komentet s'llogariten (p.sh. shembujt e komentuar).
    const sql = fs.readFileSync(path.join(DIR, file), "utf8").replace(/--[^\n]*/g, "");
    const grants = granted(sql);
    const missing = created(sql).filter((t) => !grants.has(t));
    expect(missing).toEqual([]);
  });
});

describe("kontrolli i vetë testit", () => {
  it("gjen tabelën pa GRANT dhe pranon listat", () => {
    const sql = "create table if not exists public.a (id int); create table public.b (id int); grant select on public.a, public.b to authenticated;";
    expect(created(sql)).toEqual(["a", "b"]);
    expect([...granted(sql)].sort()).toEqual(["a", "b"]);
    expect(created("create table public.c (id int);").filter((t) => !granted("grant execute on function public.f() to anon;").has(t))).toEqual(["c"]);
  });
});
