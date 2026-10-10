/**
 * Shortcuts të Android-it: mbaj gishtin mbi ikonën e Bebix → "E lagët",
 * "Bajga", "Gjumi", "Ushqim". Secili hap një lidhje bebix:// që e trajton
 * app-i (app/log/*, app/sleep/toggle) me të njëjtën radhë si widget-i — pa
 * dyfishim, edhe pa internet. Google Assistant i gjen me emër ("Hey Google,
 * Bebix E lagët") në pajisjet që e mbështesin.
 *
 * Teksti: shqip si parazgjedhje (values/), anglisht kur telefoni është në
 * anglisht (values-en/). Skedarët kanë emër të vetin, që të mos prekin
 * strings.xml të Expo-s.
 */
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SHORTCUTS = [
  { id: "diaper_wet", uri: "bebix://log/diaper?type=wet", sq: ["E lagët", "Pelenë e lagët"], en: ["Wet", "Wet diaper"] },
  { id: "diaper_dirty", uri: "bebix://log/diaper?type=dirty", sq: ["Bajga", "Pelenë me bajga"], en: ["Dirty", "Dirty diaper"] },
  { id: "sleep_toggle", uri: "bebix://sleep/toggle", sq: ["Gjumi", "Fle / U zgjua"], en: ["Sleep", "Sleep / Woke up"] },
  { id: "feeding", uri: "bebix://log/feeding", sq: ["Ushqim", "Ushqeva"], en: ["Feeding", "Log a feeding"] },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/'/g, "\\'");

function shortcutsXml(packageName) {
  const items = SHORTCUTS.map(
    (s) => `  <shortcut
    android:shortcutId="${s.id}"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/bebix_sc_${s.id}_short"
    android:shortcutLongLabel="@string/bebix_sc_${s.id}_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="${esc(s.uri)}"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity" />
  </shortcut>`
  ).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n${items}\n</shortcuts>\n`;
}

function stringsXml(lang) {
  const rows = SHORTCUTS.flatMap((s) => [
    `  <string name="bebix_sc_${s.id}_short">${esc(s[lang][0])}</string>`,
    `  <string name="bebix_sc_${s.id}_long">${esc(s[lang][1])}</string>`,
  ]).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${rows}\n</resources>\n`;
}

function withBebixShortcuts(config) {
  config = withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity["meta-data"] = activity["meta-data"] ?? [];
    const exists = activity["meta-data"].some((m) => m.$["android:name"] === "android.app.shortcuts");
    if (!exists) {
      activity["meta-data"].push({ $: { "android:name": "android.app.shortcuts", "android:resource": "@xml/bebix_shortcuts" } });
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/res");
      const pkg = cfg.android?.package;
      if (!pkg) throw new Error("withBebixShortcuts: mungon android.package te app.json");
      for (const [dir, file, body] of [
        ["xml", "bebix_shortcuts.xml", shortcutsXml(pkg)],
        ["values", "bebix_shortcuts.xml", stringsXml("sq")],
        ["values-en", "bebix_shortcuts.xml", stringsXml("en")],
      ]) {
        fs.mkdirSync(path.join(res, dir), { recursive: true });
        fs.writeFileSync(path.join(res, dir, file), body);
      }
      return cfg;
    },
  ]);
  return config;
}

module.exports = withBebixShortcuts;
module.exports.SHORTCUTS = SHORTCUTS;
module.exports.shortcutsXml = shortcutsXml;
module.exports.stringsXml = stringsXml;
