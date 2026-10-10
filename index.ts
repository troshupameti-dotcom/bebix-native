import "expo-router/entry";
import { Platform } from "react-native";

// Widget-i i Android-it ekzekuton JS-in e app-it pa e hapur atë (headless):
// detyra regjistrohet këtu, jashtë ekraneve, që të gjendet edhe kur app-i është mbyllur.
if (Platform.OS === "android") {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { registerWidgetTaskHandler } = require("react-native-android-widget") as typeof import("react-native-android-widget");
  const { widgetTaskHandler } = require("./widgets/android-home/taskHandler") as typeof import("./widgets/android-home/taskHandler");
  /* eslint-enable @typescript-eslint/no-require-imports */
  registerWidgetTaskHandler(widgetTaskHandler);
}
