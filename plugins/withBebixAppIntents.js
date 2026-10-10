/**
 * Siri / Shortcuts në iPhone: kopjon plugins/apple/BebixAppIntents.swift te
 * target-i kryesor i app-it dhe e shton në projektin e Xcode gjatë prebuild-it
 * (EAS e bën në cloud — s'duhet Mac). ios/ është i injoruar nga git (CNG).
 *
 * E provueshme vetëm pasi të ketë llogari Apple Developer; nëse ndonjëherë
 * build-i i iOS dështon këtu, mjafton të hiqet ky rresht nga app.json.
 */
/* global __dirname */
const { withDangerousMod, withXcodeProject, IOSConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const FILE = "BebixAppIntents.swift";
const SOURCE = path.join(__dirname, "apple", FILE);

function withBebixAppIntents(config) {
  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(SOURCE, path.join(dir, FILE));
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const name = cfg.modRequest.projectName;
    const filepath = `${name}/${FILE}`;
    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: name, project });
    }
    return cfg;
  });

  return config;
}

module.exports = withBebixAppIntents;
