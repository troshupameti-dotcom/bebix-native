import type { BabyGender } from "@/lib/state/types";
import type { ThemeColors } from "@/lib/theme/useThemeColors";

/**
 * Ngjyrat e orës.
 *
 * Katër ngjyra, secila për një gjë, dhe secila nga një familje tjetër tonesh.
 * Kjo është e gjithë puna: më parë gjumi dhe pelena ndanin të njëjtin ton
 * jeshil-blu, dhe ushqyerja me jashtëqitjen ishin të dyja të ngrohta — pra
 * prindi duhej të lexonte legjendën çdo herë.
 *
 * Tonet janë zgjedhur duke matur dallimin mes çdo çifti dhe kontrastin me
 * sfondin, në të dyja temat: asnjë çift nën 120 njësi dallimi, asnjë ngjyrë
 * nën 3:1 kundrejt faqes.
 *
 * Gjinia e zgjedhur te cilësimet e zhvendos tonin — kaltërt për djalë, rozë
 * për vajzë — por ndarja mes të katërtave ruhet gjithmonë. Një paletë ku
 * gjithçka është rozë do të ishte e bukur dhe e palexueshme.
 */

export type ClockPalette = {
  sleep: string;
  feeding: string;
  diaper: string;
  poop: string;
  /** Hija e natës mbi rreth. */
  night: string;
};

export function clockPalette(gender: BabyGender, theme: ThemeColors): ClockPalette {
  const dark = theme.isDark;

  if (gender === "boy") {
    // Blu / rozë / bruz / qelibar.
    return {
      sleep: dark ? "#8AA6E8" : "#2A4FA0",
      feeding: dark ? "#EC8FAB" : "#B8496E",
      diaper: dark ? "#5FC3B4" : "#137F73",
      poop: dark ? "#D2A860" : "#8C6428",
      night: theme.ink,
    };
  }

  if (gender === "girl") {
    // Manushaqe / rozë / blu / qelibar — dy nga katërt janë rozë-vjollcë,
    // pra paleta lexohet rozë pa u bërë një ton i vetëm.
    return {
      sleep: dark ? "#C08CE8" : "#7A3596",
      feeding: dark ? "#F08CA3" : "#C03A5E",
      diaper: dark ? "#7FB6E8" : "#2E6FA8",
      poop: dark ? "#D2A860" : "#8C6428",
      night: theme.ink,
    };
  }

  // Pa gjini të shënuar: bruz / rozë / indigo / qelibar.
  return {
    sleep: dark ? "#63C6B6" : "#1F6F65",
    feeding: dark ? "#F08CA9" : "#BE3C68",
    diaper: dark ? "#8EA4EE" : "#3A56A8",
    poop: dark ? "#D2A860" : "#8C6428",
    night: theme.ink,
  };
}
