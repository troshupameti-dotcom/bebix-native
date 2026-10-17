/**
 * Njoftimet në Cilësime (si te iPhone, 17 tetor): pllaka ikonash, çelës për orët e qeta, hapat e orëve dhe
 * kujtesat e ushqyerjes; asnjë emoji në tekste.
 */
import { Switch, Text } from "react-native";
import { act } from "react-test-renderer";
import type { ReactTestInstance } from "react-test-renderer";
import { renderScreen, visibleText } from "./helpers/screen";
import Notifications from "@/app/(main)/more/notifications";
import { useAppState } from "@/lib/state/AppStateContext";

function Probe() {
  const { state } = useAppState();
  const p = state.notificationPrefs;
  return <Text>{`probe:${p.quietFrom}-${p.quietTo}:${p.feedingGapH}:${p.keys.push === false ? "off" : "on"}`}</Text>;
}

const probe = (root: ReactTestInstance) => visibleText(root).find((x) => x.startsWith("probe:"));
const sw = (root: ReactTestInstance, label: string) => root.findAll((n) => n.type === Switch && n.props.accessibilityLabel === label)[0];
const press = (root: ReactTestInstance, label: string) =>
  act(() => root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0].props.onPress());

describe("njoftimet", () => {
  it("grupet me tekste standarde, pa emoji", async () => {
    const r = await renderScreen(<Notifications />);
    const text = visibleText(r.root).join(" ");
    for (const s of ["Njoftimet në telefon", "Orët e qeta", "Bebi", "Dyqani", "Komuniteti", "Ushqyerja", "Ekipi"]) expect(text).toContain(s);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("orët e qeta: çelësi i fik dhe i ndez (22:00–07:00); hapat ndryshojnë orën", async () => {
    const r = await renderScreen(<><Notifications /><Probe /></>);
    expect(probe(r.root)).toBe("probe:22-7:4:on");
    act(() => sw(r.root, "Orët e qeta").props.onValueChange(false));
    expect(probe(r.root)).toBe("probe:0-0:4:on");
    expect(visibleText(r.root)).not.toContain("22:00");
    act(() => sw(r.root, "Orët e qeta").props.onValueChange(true));
    expect(probe(r.root)).toBe("probe:22-7:4:on");
    press(r.root, "Nga +1");
    expect(probe(r.root)).toBe("probe:23-7:4:on");
  });

  it("kujtesa e ushqyerjes: −/+ me kufij; fikja e njoftimeve i çaktivizon rreshtat", async () => {
    const r = await renderScreen(<><Notifications /><Probe /></>);
    press(r.root, "Ushqyerja -1");
    expect(probe(r.root)).toBe("probe:22-7:3:on");
    act(() => sw(r.root, "Njoftimet në telefon").props.onValueChange(false));
    expect(probe(r.root)).toBe("probe:22-7:3:off");
    expect(sw(r.root, "Ushqyerja").props.disabled).toBe(true);
  });
});
