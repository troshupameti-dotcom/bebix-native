// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/tests: testet SQL ekzekutohen veçmas me PGlite (i përkohshëm), jo me jest/lint.
    ignores: ["dist/*", "supabase/functions/**", "supabase/tests/**"],
  }
]);
