import type { ImageSourcePropType } from "react-native";

/**
 * Fotot e kategorive të dyqanit.
 *
 * Janë brenda app-it, jo në Storage: nëntë figura fikse prej 130 KB gjithsej
 * ngarkohen menjëherë, punojnë pa internet dhe nuk kërkojnë asnjë kërkesë
 * rrjeti sa herë hapet dyqani. Në Storage do të ishin nëntë kërkesa çdo herë
 * për diçka që nuk ndryshon kurrë.
 *
 * Çelësi është ai i kategorisë ashtu siç rri te baza — jo një slug i ri —
 * që harta të prishet me gabim të dukshëm nëse dikush e riemërton kategorinë,
 * në vend që të heshtë dhe të mos shfaqë figurë.
 *
 * Kategoritë e reja të shtuara nga paneli s'kanë figurë këtu, dhe kjo është
 * në rregull: bien te emoji-ja, dhe paneli mund t'i japë një URL të vetën.
 *
 * Burimi: Pexels. Licenca e Pexels lejon përdorimin komercial, pa detyrim
 * atribuimi dhe me të drejtë modifikimi. Figurat janë prerë në katror dhe
 * ripërmasuar në 256×256. Mos i zëvendëso me figura nga kërkimi i thjeshtë i
 * internetit — ato zakonisht janë me të drejta autoriale.
 */
export const CATEGORY_PHOTOS: Record<string, ImageSourcePropType> = {
  Ushqyerje: require("@/assets/images/categories/ushqyerje.jpg"),
  veshje: require("@/assets/images/categories/veshje.jpg"),
  gjumi: require("@/assets/images/categories/gjumi.jpg"),
  "Higjiena & Kujdesi": require("@/assets/images/categories/higjiena.jpg"),
  "Karroca & Transport": require("@/assets/images/categories/karroca.jpg"),
  "Lodra & Zhvillim": require("@/assets/images/categories/lodra.jpg"),
  "Dhoma e bebit": require("@/assets/images/categories/dhoma.jpg"),
  "Për nënën": require("@/assets/images/categories/nena.jpg"),
  "Dhurata për bebe": require("@/assets/images/categories/dhurata.jpg"),
};

/**
 * Figura e një kategorie: ajo e panelit ka përparësi, pastaj ajo e app-it.
 *
 * `imageUrl` vjen nga paneli kur dikush ka vendosur një URL të vetën — kështu
 * çdo kategori mund të ndërrohet pa ndërtim të ri të app-it.
 */
export function categoryPhoto(key: string, imageUrl: string | null): ImageSourcePropType | null {
  if (imageUrl) return { uri: imageUrl };
  return CATEGORY_PHOTOS[key] ?? null;
}
