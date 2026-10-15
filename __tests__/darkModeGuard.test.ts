/* eslint-disable @typescript-eslint/no-require-imports -- fs/path në test, pa tipet e Node-it */
/**
 * Tema e errët njësoj në krejt app-in: asnjë tekst me ngjyrë të errët fikse dhe asnjë sfond pastel i çelët fiks
 * te komponentët. Më parë kartat me ngjyrë (ushqimi, pelenat, rritja, sugjerimi i dyqanit, kapsula...) dhe çmimi
 * kishin #17212B / #3B4652 dhe sfonde pastel fikse: në temën e errët dilnin si njolla të çelëta ose s'shiheshin.
 * Ngjyrat vijnë nga tema (className text-ink…, useThemeColors) ose nga lib/theme/tone.ts.
 */
const fs = require("fs") as { readdirSync(d: string, o: { recursive: true }): string[]; readFileSync(f: string, e: string): string; statSync(f: string): { isFile(): boolean } };
const path = require("path") as { join(...p: string[]): string; sep: string };
declare const __dirname: string;

const ROOT = path.join(__dirname, "..");
/** Me pamje fikse me qëllim: modaliteti i natës (e kuqe mbi të zezë), kartat për t'u ndarë si foto, ekrani i
 * gabimit (jashtë temës), sllajdet e muajit (me ngjyrë të plotë), dhe çmimi (vlera e dritës, e ndërruar në kod). */
const FIXED_BY_DESIGN = [
  /components\/baby\/Night(Mode|Light|Clock)\.tsx$/,
  /app\/\(main\)\/more\/night-mode\.tsx$/,
  /components\/share\//,
  /components\/ui\/AppErrorBoundary\.tsx$/,
  /app\/\(main\)\/baby\/month-recap\.tsx$/,
  /app\/\(main\)\/baby\/share-card\.tsx$/,
];

const DARK_TEXT = /(color: ?"#(17212B|3B4652|2C271F|1C1A16|5C6670)")|(text-\[#(17212B|3B4652|2C271F|1C1A16)\])/;
// Sfondet pastel të toneve të vjetra (vlerat e dritës): duhen marrë nga useTone/useTones, jo fikse.
const PASTEL_BG = /(backgroundColor: ?"#(F6DCE7|D9E7F2|E1EBD5|F3E4C8|E7DAEF|F3DCCF|FBEFDD|FFF8EF)")|(bg-\[#(FBEFDD|FFF8EF)\])/;

function sources(): string[] {
  return ["app", "components"].flatMap((dir) =>
    fs
      .readdirSync(path.join(ROOT, dir), { recursive: true })
      .map((f) => `${dir}/${f.split(path.sep).join("/")}`)
      .filter((f) => f.endsWith(".tsx") && !FIXED_BY_DESIGN.some((re) => re.test(f)))
  );
}

describe("tema e errët njësoj kudo", () => {
  it("asnjë tekst me ngjyrë të errët fikse", () => {
    const hits = sources().flatMap((f) =>
      fs
        .readFileSync(path.join(ROOT, f), "utf8")
        .split("\n")
        .flatMap((line, i) => (DARK_TEXT.test(line) ? [`${f}:${i + 1}`] : []))
    );
    expect(hits).toEqual([]);
  });

  it("asnjë sfond pastel i çelët fiks (në temën e errët dilte si njollë)", () => {
    const hits = sources().flatMap((f) =>
      fs
        .readFileSync(path.join(ROOT, f), "utf8")
        .split("\n")
        .flatMap((line, i) => (PASTEL_BG.test(line) ? [`${f}:${i + 1}`] : []))
    );
    expect(hits).toEqual([]);
  });
});
