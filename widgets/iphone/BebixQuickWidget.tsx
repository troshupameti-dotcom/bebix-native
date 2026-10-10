import { HStack, Image, Link, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, padding, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { IosWidgetProps } from "@/lib/widgets/iosProps";

/**
 * Widget-i i iPhone-it (ekrani kryesor dhe ekrani i kyçur).
 *
 * Funksioni me direktivën 'widget' kthehet në tekst dhe ekzekutohet brenda
 * widget-it, jo në app: s'ka akses te asgjë jashtë tij (ngjyrat dhe
 * ndihmësit deklarohen brenda). Tekstet vijnë gati nga app-i, në gjuhën e
 * prindit (lib/widgets/iosProps.ts). Prekjet hapin lidhjet bebix:// — e
 * njëjta radhë si widget-i i Android-it, pa dyfishim.
 */
const BebixQuick = (props: IosWidgetProps, env: WidgetEnvironment) => {
  "widget";
  const dark = env.colorScheme === "dark";
  const ink = dark ? "#F3F3F1" : "#17212B";
  const soft = dark ? "#A9B1B8" : "#5C6670";
  const bg = dark ? "#1C2329" : "#FFFFFF";
  const pink = dark ? "#F08DB6" : "#B8336A";
  const blue = dark ? "#8DBDE8" : "#2E6FA8";
  const purple = dark ? "#C9A0DD" : "#7A3596";

  // Para pamjes së parë nga app-i.
  if (!props || !props.feeding) {
    return (
      <VStack modifiers={[containerBackground(bg, "widget"), widgetURL("bebix://")]}>
        <Text modifiers={[font({ size: 16, weight: "bold" }), foregroundStyle(ink)]}>Bebix</Text>
      </VStack>
    );
  }

  const family = env.widgetFamily;

  if (family === "accessoryInline") {
    return (
      <Text modifiers={[widgetURL("bebix://")]}>
        {props.sleep.asleep ? `${props.sleep.detail} ${props.sleep.value}` : `${props.feeding.label} ${props.feeding.value}`}
      </Text>
    );
  }

  if (family === "accessoryCircular") {
    return (
      <VStack spacing={2} modifiers={[widgetURL(props.sleep.asleep ? "bebix://sleep" : "bebix://log/feeding")]}>
        <Image systemName={props.sleep.asleep ? "moon.zzz.fill" : "fork.knife"} size={14} />
        <Text modifiers={[font({ size: 12, weight: "semibold" })]}>{props.sleep.asleep ? props.sleep.value : props.feeding.value}</Text>
      </VStack>
    );
  }

  if (family === "accessoryRectangular") {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL("bebix://")]}>
        <Text modifiers={[font({ size: 13, weight: "semibold" })]}>{`${props.feeding.label} ${props.feeding.value}`}</Text>
        <Text modifiers={[font({ size: 13 })]}>{`${props.diaper.label} ${props.diaper.value}`}</Text>
        <Text modifiers={[font({ size: 13 })]}>{`${props.sleep.label} ${props.sleep.value}`}</Text>
      </VStack>
    );
  }

  const row = (label: string, value: string, detail: string, color: string) => (
    <VStack alignment="leading" spacing={1}>
      <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(color)]}>{label}</Text>
      <Text modifiers={[font({ size: 17, weight: "bold" }), foregroundStyle(ink)]}>{value}</Text>
      {detail ? <Text modifiers={[font({ size: 11 }), foregroundStyle(soft)]}>{detail}</Text> : null}
    </VStack>
  );

  if (family === "systemSmall") {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[containerBackground(bg, "widget"), widgetURL("bebix://")]}>
        {row(props.feeding.label, props.feeding.value, props.feeding.detail, pink)}
        {row(props.diaper.label, props.diaper.value, "", blue)}
        {row(props.sleep.label, props.sleep.value, props.sleep.detail, purple)}
      </VStack>
    );
  }

  // systemMedium: tri kutitë sipër, tri lidhje poshtë (pelenë e lagët, bajga, gjumi).
  const action = (label: string, url: string, color: string) => (
    <Link destination={url}>
      <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle(color), padding({ vertical: 8, horizontal: 10 })]}>{label}</Text>
    </Link>
  );
  return (
    <VStack alignment="leading" spacing={8} modifiers={[containerBackground(bg, "widget")]}>
      <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(ink)]}>{props.title}</Text>
      <HStack spacing={10}>
        <Link destination="bebix://log/feeding">{row(props.feeding.label, props.feeding.value, props.feeding.detail, pink)}</Link>
        <Spacer />
        <Link destination="bebix://log/diaper">{row(props.diaper.label, props.diaper.value, props.diaper.detail, blue)}</Link>
        <Spacer />
        <Link destination="bebix://sleep">{row(props.sleep.label, props.sleep.value, props.sleep.detail, purple)}</Link>
      </HStack>
      <HStack spacing={6}>
        {action(props.actions.wet, "bebix://log/diaper?type=wet", blue)}
        {action(props.actions.dirty, "bebix://log/diaper?type=dirty", blue)}
        <Spacer />
        {action(props.actions.sleep, "bebix://sleep/toggle", purple)}
      </HStack>
    </VStack>
  );
};

export default createWidget("BebixQuick", BebixQuick);
