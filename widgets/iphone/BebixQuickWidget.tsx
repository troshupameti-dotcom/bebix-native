import { HStack, Image, Link, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { background, containerBackground, cornerRadius, font, foregroundStyle, lineLimit, minimumScaleFactor, padding, widgetURL } from "@expo/ui/swift-ui/modifiers";
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
  // Të njëjtat ngjyra si app-i dhe widget-i i Android-it (theme/palette.js, lib/theme/tone.ts).
  const ink = dark ? "#F2EDE5" : "#1C1A16";
  const soft = dark ? "#C1B7A9" : "#565047";
  const bg = dark ? "#1E1B17" : "#FFFFFF";
  const line = dark ? "#2B2620" : "#EFE9E1";
  const pink = dark ? "#E08AB0" : "#9E2C5B";
  const pinkBg = dark ? "#3A222B" : "#F6DCE7";
  const blue = dark ? "#8DB4D8" : "#285F90";
  const blueBg = dark ? "#1F2A33" : "#D9E7F2";
  const amber = dark ? "#D9B47A" : "#845612";
  const amberBg = dark ? "#352B1C" : "#F3E4C8";
  const purple = dark ? "#BE95D0" : "#692E81";
  const purpleBg = dark ? "#2E2232" : "#E7DAEF";

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
      <Text modifiers={[font({ size: 17, weight: "bold" }), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.7)]}>{value}</Text>
      {detail ? <Text modifiers={[font({ size: 11 }), foregroundStyle(soft), lineLimit(1)]}>{detail}</Text> : null}
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

  // Kutia me ngjyrë (e madhja): emri, ora e madhe dhe hollësia; prekja hap ekranin përkatës.
  const tile = (url: string, label: string, value: string, detail: string, color: string, tint: string, size: number) => (
    <Link destination={url}>
      <HStack modifiers={[padding({ all: 12 }), background(tint), cornerRadius(18)]}>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(color)]}>{label}</Text>
          <Text modifiers={[font({ size, weight: "bold" }), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.6)]}>{value}</Text>
          {detail ? <Text modifiers={[font({ size: 12 }), foregroundStyle(soft), lineLimit(1)]}>{detail}</Text> : null}
        </VStack>
        <Spacer />
      </HStack>
    </Link>
  );
  // Butoni: kapsulë me ngjyrë, teksti zvogëlohet në vend që të pritet.
  const action = (label: string, url: string, color: string, tint: string) => (
    <Link destination={url}>
      <HStack modifiers={[padding({ vertical: 9, horizontal: 10 }), background(tint), cornerRadius(14)]}>
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle(color), lineLimit(1), minimumScaleFactor(0.7)]}>{label}</Text>
        <Spacer />
      </HStack>
    </Link>
  );
  const actions = (
    <HStack spacing={6}>
      {action(props.actions.feed, "bebix://quick/feeding", pink, pinkBg)}
      {action(props.actions.wet, "bebix://log/diaper?type=wet", blue, blueBg)}
      {action(props.actions.dirtyShort, "bebix://log/diaper?type=dirty", amber, amberBg)}
      {action(props.actions.sleep, "bebix://sleep/toggle", purple, purpleBg)}
    </HStack>
  );

  // systemLarge (iPhone) dhe systemExtraLarge (iPad): titulli, kutitë me ngjyrë, butonat dhe përmbledhja e ditës.
  if (family === "systemLarge" || family === "systemExtraLarge") {
    const xl = family === "systemExtraLarge";
    const tiles = [
      tile("bebix://log/feeding", props.feeding.label, props.feeding.value, props.feeding.detail, pink, pinkBg, xl ? 30 : 26),
      tile("bebix://log/diaper", props.diaper.label, props.diaper.value, props.diaper.detail, blue, blueBg, xl ? 30 : 26),
      tile("bebix://sleep", props.sleep.label, props.sleep.value, props.sleep.detail, purple, purpleBg, xl ? 30 : 26),
    ];
    return (
      <VStack alignment="leading" spacing={10} modifiers={[containerBackground(bg, "widget")]}>
        <HStack>
          <Text modifiers={[font({ size: 15, weight: "bold" }), foregroundStyle(ink), lineLimit(1)]}>{props.title}</Text>
          <Spacer />
        </HStack>
        {xl ? <HStack spacing={10}>{tiles}</HStack> : <VStack spacing={8}>{tiles}</VStack>}
        {actions}
        {props.today ? (
          <HStack modifiers={[padding({ vertical: 8, horizontal: 12 }), background(line), cornerRadius(14)]}>
            <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(ink)]}>{props.today.label}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 12 }), foregroundStyle(soft), lineLimit(1), minimumScaleFactor(0.7)]}>{props.today.summary}</Text>
          </HStack>
        ) : null}
      </VStack>
    );
  }

  // systemMedium: tri orët sipër, katër butona poshtë (ushqim, e lagur, jashtëqitje, gjumi).
  return (
    <VStack alignment="leading" spacing={8} modifiers={[containerBackground(bg, "widget")]}>
      <HStack spacing={10}>
        <Link destination="bebix://log/feeding">{row(props.feeding.label, props.feeding.value, props.feeding.detail, pink)}</Link>
        <Spacer />
        <Link destination="bebix://log/diaper">{row(props.diaper.label, props.diaper.value, props.diaper.detail, blue)}</Link>
        <Spacer />
        <Link destination="bebix://sleep">{row(props.sleep.label, props.sleep.value, props.sleep.detail, purple)}</Link>
      </HStack>
      {actions}
    </VStack>
  );
};

export default createWidget("BebixQuick", BebixQuick);
