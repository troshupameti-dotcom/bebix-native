import type { BabyGender } from "@/lib/state/types";
import type { ThemeColors } from "@/lib/theme/useThemeColors";

/**
 * Ngjyrat e orës 24-orëshe.
 *
 * Gjinia e zgjedhur te cilësimet e zhvendos tonin: kaltërt për djalë, rozë
 * për vajzë, dhe theksi i zakonshëm i app-it kur s'është shënuar asgjë.
 * Zhvendoset vetëm TONI — ngopja dhe errësira mbeten ato të paletës, që
 * rrethi të mos dalë si lodër mes një app-i të qetë.
 *
 * Katër ngjyra, secila për një gjë: gjumi është bllok, tri të tjerat janë
 * çaste. Ngjyrat nuk përsëriten, sepse i njëjti ton për dy gjëra do ta bënte
 * rrethin të palexueshëm pikërisht atje ku ka më shumë shënime.
 */

export type ClockPalette = {
  sleep: string;
  feeding: string;
  diaper: string;
  poop: string;
  /** Hija e natës mbi rreth. */
  night: string;
  /** Unaza bosh nën gjithçka. */
  track: string;
};

export function clockPalette(gender: BabyGender, theme: ThemeColors): ClockPalette {
  const dark = theme.isDark;

  if (gender === "boy") {
    return {
      sleep: dark ? "#7FA6D4" : "#3F6795",
      feeding: dark ? "#8FC4C6" : "#2F7F82",
      diaper: dark ? "#9DB2C9" : "#5E7A96",
      poop: dark ? "#C0A184" : "#8A6A4C",
      night: theme.ink,
      track: theme.creamSoft,
    };
  }

  if (gender === "girl") {
    return {
      sleep: dark ? "#D79FB0" : "#8F4E68",
      feeding: dark ? "#E0A5AE" : "#A85A62",
      diaper: dark ? "#C8A9BC" : "#7D5C73",
      poop: dark ? "#C0A184" : "#8A6A4C",
      night: theme.ink,
      track: theme.creamSoft,
    };
  }

  // Pa gjini të shënuar: ngjyrat e vetë app-it.
  return {
    sleep: theme.olive,
    feeding: theme.orange,
    diaper: dark ? "#8FBEC0" : "#3D7B7C",
    poop: dark ? "#C0A184" : "#8A6A4C",
    night: theme.ink,
    track: theme.creamSoft,
  };
}
