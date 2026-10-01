import { useWindowDimensions } from "react-native";

/**
 * Gjerësia e përmbajtjes në çdo pajisje: telefon, i palosshëm (Samsung Fold,
 * Pixel Fold), tablet (iPad, Galaxy Tab), edhe kur rrotullohet ose ndahet ekrani.
 *
 * Në telefon është gjerësia e plotë; në ekran të gjerë përmbajtja mbahet në
 * qendër me kufi, që formularët të mos shtrihen nëpër gjithë tabletin. Hook-u
 * lexohet gjatë punës (jo një herë në nisje), prandaj ndjek palosjen e
 * rrotullimin.
 */
export const MAX_CONTENT_WIDTH = 860;

export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(width, MAX_CONTENT_WIDTH);
}

/** Kolonat e rrjetës së produkteve sipas gjerësisë së përmbajtjes. */
export function gridColumns(width: number): number {
  if (width >= 820) return 4;
  if (width >= 560) return 3;
  return 2;
}
