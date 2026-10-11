/**
 * Build-i i Android-it dështonte me "Duplicate class androidx.work.*Kt":
 *  - react-native-android-widget kërkon androidx.work:work-runtime:2.8.1;
 *  - expo-widgets (për iPhone, por kompilohet edhe në Android) sjell Glance,
 *    i cili tërheq androidx.work:work-runtime-ktx:2.7.1.
 * Nga versioni 2.8, klasat e "-ktx" janë brenda work-runtime, ndaj të dyja
 * bashkë përplasen. Duke kërkuar work-runtime-ktx 2.8.1, Gradle zgjedh atë
 * version (bosh, pa klasa të veta) dhe dyfishimi zhduket.
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const MARK = "// bebix: work-runtime-ktx (withWorkManagerFix)";
const LINE = `    implementation("androidx.work:work-runtime-ktx:2.8.1") ${MARK}`;

module.exports = function withWorkManagerFix(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;
    const anchor = /dependencies\s*\{/;
    if (!anchor.test(src)) throw new Error("withWorkManagerFix: s'u gjet blloku dependencies te app/build.gradle");
    cfg.modResults.contents = src.replace(anchor, (m) => `${m}\n${LINE}`);
    return cfg;
  });
};
