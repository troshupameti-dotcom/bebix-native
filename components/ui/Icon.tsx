import Svg, { Path, Circle, Rect, Line, Ellipse, G } from "react-native-svg";
import { resolveThemeColor, useThemeColors } from "@/lib/theme/useThemeColors";

export type IconName =
  | "home"
  | "baby"
  | "diaper"
  | "shop"
  | "community"
  | "more"
  | "settings"
  | "chevronLeft"
  | "chevronRight"
  | "share"
  | "edit"
  | "bell"
  | "cart"
  | "search"
  | "sparkle"
  | "send"
  | "plus"
  | "camera"
  | "flash"
  | "close"
  | "trash"
  | "user"
  | "heart"
  | "comment"
  | "bookmark"
  | "moon"
  | "globe"
  | "lock"
  | "download"
  | "family"
  | "shield"
  | "repeat"
  | "droplet"
  | "spoon"
  | "chart"
  | "cube"
  | "check"
  | "flame"
  | "bath"
  | "pill"
  | "play"
  | "bottle"
  | "syringe"
  | "eye"
  | "eyeOff"
  | "star"
  | "starFilled"
  | "logout"
  | "grid"
  | "soother"
  | "gift"
  | "babyBottle"
  | "teat"
  | "cup"
  | "clip"
  | "tooth"
  | "toothbrush"
  | "nursing"
  | "bowl";

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/**
 * Every Bebix icon glyph, ported from the web Icon.tsx. RN can't take raw
 * SVG markup strings the way the web build could (no dangerouslySetInnerHTML
 * equivalent for SVG), so each glyph is expressed as JSX elements instead —
 * same visual paths, different plumbing.
 */
export function Icon({ name, size = 22, color = "currentColor" }: IconProps) {
  // Ngjyrat e paletes (p.sh. "#2C271F") perkthehen ne ngjyren e temes aktuale,
  // qe ikonat te mos zhduken mbi sfondin e erret.
  const theme = useThemeColors();
  const common = {
    stroke: resolveThemeColor(color, theme),
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {GLYPHS[name](common)}
    </Svg>
  );
}

type CommonProps = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: "round";
  strokeLinejoin: "round";
  fill: string;
};

const GLYPHS: Record<IconName, (p: CommonProps) => React.ReactNode> = {
  home: (p) => (
    <>
      <Path d="M4 11.5 12 4l8 7.5" {...p} />
      <Path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" {...p} />
    </>
  ),
  baby: (p) => (
    <>
      <Circle cx="12" cy="9" r="4" {...p} />
      <Path d="M6 21c0-4 3-6 6-6s6 2 6 6" {...p} />
    </>
  ),
  // Pelenë e palosur, me dy "krahë" anësorë — jo më figura e përgjithshme "baby".
  diaper: (p) => (
    <>
      <Path d="M5 8.2h14a1 1 0 0 1 1 1v1.6c0 4.6-3.1 8.7-8 9.7-4.9-1-8-5.1-8-9.7V9.2a1 1 0 0 1 1-1Z" {...p} />
      <Path d="M5.5 8.2V6.4a1.8 1.8 0 0 1 1.8-1.8h1.4M18.5 8.2V6.4a1.8 1.8 0 0 0-1.8-1.8h-1.4" {...p} />
    </>
  ),
  shop: (p) => (
    <>
      <Path d="M4 8l1.5-4h13L20 8" {...p} />
      <Path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" {...p} />
      <Path d="M9 12a3 3 0 0 0 6 0" {...p} />
    </>
  ),
  community: (p) => (
    <>
      <Circle cx="8" cy="9" r="3" {...p} />
      <Circle cx="16" cy="9" r="3" {...p} />
      <Path d="M2 20c0-3 2.5-5 6-5s6 2 6 5" {...p} />
      <Path d="M10 20c0-3 2.5-5 6-5s6 2 6 5" {...p} />
    </>
  ),
  more: (p) => (
    <>
      <Circle cx="5" cy="12" r="1.6" fill={p.stroke} />
      <Circle cx="12" cy="12" r="1.6" fill={p.stroke} />
      <Circle cx="19" cy="12" r="1.6" fill={p.stroke} />
    </>
  ),
  // Ingranazh, si simboli i Cilesimeve ne iOS: nje trup i rrumbullaket
  // plus tete "dhembe" — jo tri pika, qe nuk lidhen dot me "cilesimet".
  settings: (p) => (
    <>
      <Circle cx="12" cy="12" r="5" {...p} />
      <Circle cx="12" cy="12" r="1.5" fill={p.stroke} />
      <Line x1="18" y1="12" x2="20.5" y2="12" {...p} />
      <Line x1="16.24" y1="16.24" x2="18.01" y2="18.01" {...p} />
      <Line x1="12" y1="18" x2="12" y2="20.5" {...p} />
      <Line x1="7.76" y1="16.24" x2="5.99" y2="18.01" {...p} />
      <Line x1="6" y1="12" x2="3.5" y2="12" {...p} />
      <Line x1="7.76" y1="7.76" x2="5.99" y2="5.99" {...p} />
      <Line x1="12" y1="6" x2="12" y2="3.5" {...p} />
      <Line x1="16.24" y1="7.76" x2="18.01" y2="5.99" {...p} />
    </>
  ),
  chevronLeft: (p) => <Path d="M15 18l-6-6 6-6" {...p} />,
  chevronRight: (p) => <Path d="M9 6l6 6-6 6" {...p} />,
  share: (p) => (
    <>
      <Circle cx="18" cy="5" r="2.4" {...p} />
      <Circle cx="6" cy="12" r="2.4" {...p} />
      <Circle cx="18" cy="19" r="2.4" {...p} />
      <Path d="M8.2 10.7 15.8 6.3M8.2 13.3l7.6 4.4" {...p} />
    </>
  ),
  edit: (p) => <Path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5V20Z" {...p} />,
  bell: (p) => (
    <>
      <Path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" {...p} />
      <Path d="M9.5 18a2.5 2.5 0 0 0 5 0" {...p} />
    </>
  ),
  cart: (p) => (
    <>
      <Circle cx="9" cy="20" r="1.4" fill={p.stroke} />
      <Circle cx="18" cy="20" r="1.4" fill={p.stroke} />
      <Path d="M2.5 3h2l2.2 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H6" {...p} />
    </>
  ),
  search: (p) => (
    <>
      <Circle cx="11" cy="11" r="6.5" {...p} />
      <Path d="M20 20l-4.4-4.4" {...p} />
    </>
  ),
  sparkle: (p) => <Path d="M12 3l1.6 4.8L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.2L12 3Z" {...p} />,
  send: (p) => <Path d="M3 11l17-7-7 17-2.5-7L3 11Z" {...p} />,
  plus: (p) => <Path d="M12 5v14M5 12h14" {...p} />,
  camera: (p) => (
    <>
      <Path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" {...p} />
      <Circle cx="12" cy="13.5" r="3.4" {...p} />
    </>
  ),
  flash: (p) => <Path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" {...p} />,
  close: (p) => <Path d="M6 6l12 12M18 6 6 18" {...p} />,
  trash: (p) => <Path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10.5v6M14 10.5v6" {...p} />,
  user: (p) => (
    <>
      <Circle cx="12" cy="8.5" r="3.8" {...p} />
      <Path d="M4.5 20c1.3-3.6 4.2-5.5 7.5-5.5s6.2 1.9 7.5 5.5" {...p} />
    </>
  ),
  heart: (p) => <Path d="M12 20.5S3.5 15 3.5 9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2c0 6-8.5 11.5-8.5 11.5Z" {...p} />,
  comment: (p) => <Path d="M4 5h16v11H9l-5 4V5Z" {...p} />,
  bookmark: (p) => <Path d="M6 3.5h12v17l-6-4-6 4v-17Z" {...p} />,
  star: (p) => <Path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" {...p} />,
  // Ylli i mbushur: e njejta forme, e lyer me ngjyren e vijes.
  starFilled: (p) => <Path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" {...p} fill={p.stroke} />,
  moon: (p) => <Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" {...p} />,
  globe: (p) => (
    <>
      <Circle cx="12" cy="12" r="8.5" {...p} />
      <Path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 15.6 0 17M12 3.5c-2.5 2.4-2.5 15.6 0 17" {...p} />
    </>
  ),
  lock: (p) => (
    <>
      <Rect x="5" y="10.5" width="14" height="9" rx="2" {...p} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...p} />
    </>
  ),
  // Dalja: dera me shigjetën që del jashtë.
  logout: (p) => (
    <>
      <Path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" {...p} />
      <Path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" {...p} />
    </>
  ),
  download: (p) => (
    <>
      <Path d="M12 3.5v11M8 11l4 4 4-4" {...p} />
      <Path d="M4.5 17.5V20h15v-2.5" {...p} />
    </>
  ),
  family: (p) => (
    <>
      <Circle cx="8" cy="8" r="2.6" {...p} />
      <Circle cx="16" cy="8" r="2.6" {...p} />
      <Path d="M3 20c0-3 2.2-5 5-5s5 2 5 5" {...p} />
      <Path d="M11 20c0-3 2.2-5 5-5s5 2 5 5" {...p} />
    </>
  ),
  shield: (p) => <Path d="M12 3.5 19 6v6c0 4.5-3 7-7 8.5-4-1.5-7-4-7-8.5V6l7-2.5Z" {...p} />,
  repeat: (p) => <Path d="M4 7h13l-3-3M20 17H7l3 3" {...p} />,
  droplet: (p) => <Path d="M12 3s6.5 7 6.5 11.5A6.5 6.5 0 0 1 5.5 14.5C5.5 10 12 3 12 3Z" {...p} />,
  // Shishe ushqyerjeje — jo më "lugë" e paqartë.
  spoon: (p) => (
    <>
      <Rect x="10.8" y="2.4" width="2.4" height="2.3" rx="1" {...p} />
      <Path d="M12 4.7v1.8" {...p} />
      <Line x1="9.8" y1="4.9" x2="14.2" y2="4.9" {...p} />
      <Rect x="7" y="7.2" width="10" height="12.6" rx="3.4" {...p} />
      <Line x1="7" y1="13.2" x2="17" y2="13.2" {...p} />
    </>
  ),
  chart: (p) => <Path d="M4 20V10M11 20V4M18 20v-7" {...p} />,
  cube: (p) => (
    <>
      <Path d="M12 3 20 7v10l-8 4-8-4V7l8-4Z" {...p} />
      <Path d="M4 7l8 4 8-4M12 11v10" {...p} />
    </>
  ),
  check: (p) => <Path d="M4 12l5 5 11-11" {...p} />,
  flame: (p) => (
    <Path
      d="M12 2c-1 3-4 4.2-4 8.2a4 4 0 0 0 8 0c0-1-.6-1.8-1-2.6.9.9 2 2.8 2 4.6a5 5 0 0 1-10 0c0-5.2 3.4-6.6 5-10.2z"
      {...p}
    />
  ),
  bath: (p) => (
    <>
      <Rect x="3" y="12" width="18" height="7" rx="2" {...p} />
      <Path d="M5 12V7a3 3 0 0 1 6 0" {...p} />
      <Line x1="3" y1="19" x2="3" y2="21" {...p} />
      <Line x1="21" y1="19" x2="21" y2="21" {...p} />
    </>
  ),
  pill: (p) => (
    <>
      <Rect x="4.5" y="8.5" width="15" height="7" rx="3.5" transform="rotate(-25 12 12)" {...p} />
      <Line x1="9.5" y1="9.5" x2="14.5" y2="14.5" {...p} />
    </>
  ),
  play: (p) => (
    <>
      <Circle cx="12" cy="12" r="9" {...p} />
      <Path d="M10 8.3 16 12l-6 3.7V8.3z" {...p} />
    </>
  ),
  // biberoni: thithka, unaza dhe shishja me dy shenja sasie
  bottle: (p) => (
    <>
      <Path d="M10.5 5.6V4.4a1.5 1.5 0 0 1 3 0v1.2" {...p} />
      <Rect x="8.6" y="5.6" width="6.8" height="2.4" rx="0.8" {...p} />
      <Path d="M9.4 8 9 10.2c-.3 1.2-.5 2.4-.5 3.6V19a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-5.2c0-1.2-.2-2.4-.5-3.6L14.6 8" {...p} />
      <Path d="M8.6 13.4h2.6M8.6 16.6h2.6" {...p} />
    </>
  ),
  syringe: (p) => (
    <>
      <Path d="M20 4l-3 3" {...p} />
      <Path d="M15.5 7.5 6 17a1.6 1.6 0 0 1-2.3-2.3L13.2 5.2" {...p} />
      <Path d="M12.5 7.2l4.3 4.3" {...p} />
      <Path d="M9.8 9.9l1.9 1.9" {...p} />
    </>
  ),
  eye: (p) => (
    <>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" {...p} />
      <Circle cx="12" cy="12" r="3" {...p} />
    </>
  ),
  eyeOff: (p) => (
    <>
      <Path d="M3 3l18 18" {...p} />
      <Path
        d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a13.5 13.5 0 0 1-3.1 4M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.6-.2 3.7-.6"
        {...p}
      />
      <Path d="M9.5 9.5a3 3 0 0 0 4.2 4.2" {...p} />
    </>
  ),

  // Nënkategoritë e dyqanit: të njëjtat vizatime si te webi (components/Icon.tsx). `babyBottle` është shishja me
  // thithkë e dyqanit; `bottle` mbetet ajo e ushqyerjes.
  grid: (p) => (
    <>
      <Rect x="4" y="4" width="7" height="7" rx="1.8" {...p} />
      <Rect x="13" y="4" width="7" height="7" rx="1.8" {...p} />
      <Rect x="4" y="13" width="7" height="7" rx="1.8" {...p} />
      <Rect x="13" y="13" width="7" height="7" rx="1.8" {...p} />
    </>
  ),
  soother: (p) => (
    <>
      <Path d="M12 3.5c1.7 0 2.7 1.4 2.7 3 0 1-.5 1.7-.9 2.5h-3.6c-.4-.8-.9-1.5-.9-2.5 0-1.6 1-3 2.7-3Z" {...p} />
      <Rect x="4" y="9" width="16" height="4.6" rx="2.3" {...p} />
      <Circle cx="12" cy="17.2" r="3.6" {...p} />
    </>
  ),
  gift: (p) => (
    <>
      <Rect x="3.5" y="8" width="17" height="4" rx="1.2" {...p} />
      <Path d="M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7" {...p} />
      <Path d="M12 8v12.5" {...p} />
      <Path d="M12 8C11 5.5 9.5 3.5 7.7 3.5a2.25 2.25 0 0 0 0 4.5H12Z" {...p} />
      <Path d="M12 8c1-2.5 2.5-4.5 4.3-4.5a2.25 2.25 0 0 1 0 4.5H12Z" {...p} />
    </>
  ),
  babyBottle: (p) => (
    <>
      <Path d="M10 7c0-1.1.4-1.7.9-2.3.4-.5.6-1.2 1.1-1.2s.7.7 1.1 1.2c.5.6.9 1.2.9 2.3" {...p} />
      <Rect x="8" y="7" width="8" height="2.6" rx="1" {...p} />
      <Path d="M8.6 9.6C7.7 10.8 7 12 7 13.6V19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-5.4c0-1.6-.7-2.8-1.6-4" {...p} />
      <Path d="M7 14h3.5M7 17.5h3.5" {...p} />
    </>
  ),
  teat: (p) => (
    <>
      <Path d="M9.8 12.5c0-1.6-.8-2.6-.8-4.4C9 5.5 10.2 3.5 12 3.5s3 2 3 4.6c0 1.8-.8 2.8-.8 4.4" {...p} />
      <Path d="M6.5 12.5h11a1.5 1.5 0 0 1 1.5 1.5v.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V14a1.5 1.5 0 0 1 1.5-1.5Z" {...p} />
      <Path d="M7.5 16.5V19A1.5 1.5 0 0 0 9 20.5h6a1.5 1.5 0 0 0 1.5-1.5v-2.5" {...p} />
    </>
  ),
  cup: (p) => (
    <>
      <Path d="M10 7V5.6A1.6 1.6 0 0 1 11.6 4H14" {...p} />
      <Rect x="6.5" y="7" width="11" height="2.6" rx="1" {...p} />
      <Path d="M7.6 9.6l.8 9.4a1.7 1.7 0 0 0 1.7 1.5h3.8a1.7 1.7 0 0 0 1.7-1.5l.8-9.4" {...p} />
      <Path d="M7.9 12.6H6.4a1.9 1.9 0 0 0 0 3.8h1.8" {...p} />
      <Path d="M16.1 12.6h1.5a1.9 1.9 0 0 1 0 3.8h-1.8" {...p} />
    </>
  ),
  clip: (p) => <Path d="m20.5 11.5-8.6 8.6a5.6 5.6 0 0 1-7.9-7.9l8.6-8.6a3.7 3.7 0 0 1 5.3 5.3l-8.6 8.5a1.9 1.9 0 0 1-2.6-2.6l8-7.9" {...p} />,
  tooth: (p) => (
    <Path
      d="M12 6.2c-1.4-1-2.6-1.7-4-1.7-2.4 0-4 1.9-4 4.4 0 1.8.7 3 1.1 4.5.5 2 .6 6.6 2.4 6.6 1.7 0 1.3-4.3 2.2-5.6.5-.7 1.1-.9 2.3-.9s1.8.2 2.3.9c.9 1.3.5 5.6 2.2 5.6 1.8 0 1.9-4.6 2.4-6.6.4-1.5 1.1-2.7 1.1-4.5 0-2.5-1.6-4.4-4-4.4-1.4 0-2.6.7-4 1.7Z"
      {...p}
    />
  ),
  toothbrush: (p) => (
    <G transform="rotate(40 12 12)">
      <Path d="M11.5 21.5V11" {...p} />
      <Rect x="9" y="2.5" width="5" height="8.5" rx="1.8" {...p} />
      <Path d="M14 4.6h3.5M14 6.8h3.5M14 9h3.5" {...p} />
    </G>
  ),
  nursing: (p) => (
    <>
      <Path d="M12 20.5S3.5 15 3.5 9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2c0 6-8.5 11.5-8.5 11.5Z" {...p} />
      <Path d="M12 9.6s-2 2.1-2 3.6a2 2 0 0 0 4 0c0-1.5-2-3.6-2-3.6Z" {...p} />
    </>
  ),
  bowl: (p) => (
    <>
      <Path d="M3.5 12h17a8.5 8.5 0 0 1-5.5 7.9v.6H9v-.6A8.5 8.5 0 0 1 3.5 12Z" {...p} />
      <Path d="M13.8 12l3.8-5" {...p} />
      <Ellipse cx="18.7" cy="5.2" rx="1.5" ry="2.3" transform="rotate(37 18.7 5.2)" {...p} />
    </>
  ),
};
