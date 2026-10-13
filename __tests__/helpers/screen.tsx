/* eslint-disable @typescript-eslint/no-require-imports -- fabrikat e jest.mock ekzekutohen para importeve, ndaj përdorin require() */
/**
 * Ndihmës për testet e ekraneve: ekrani i vërtetë brenda provider-ave të vërtetë (gjuha, state-i, toast),
 * siç i mbështjell app/_layout.tsx. Mock-ohet vetëm bota e jashtme: Supabase (si pa rrjet), ruajtja,
 * navigimi dhe animacionet. Importoje E PARA te testi, që mock-et të vendosen para ekranit.
 */
import { type ReactElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { Text, TextInput } from "react-native";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { AppStateProvider } from "@/lib/state/AppStateContext";
import { ToastProvider } from "@/lib/toast/ToastContext";

jest.mock("@/lib/supabase/client", () => {
  // Çdo pyetje kthen këtë: si telefon pa rrjet (gjendja më e zakonshme e gabimeve).
  const OFFLINE = { data: null, error: { message: "offline", code: "offline" }, count: null };
  // Zinxhir i pafund: from().select().eq()... dhe në fund `await` kthen OFFLINE.
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => (prop === "then" ? (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(OFFLINE).then(ok, ko) : chain),
    apply: () => chain,
  });
  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    startAutoRefresh: () => {},
    stopAutoRefresh: () => {},
    signOut: async () => ({ error: null }),
  };
  return { supabase: new Proxy({ auth }, { get: (t, prop) => (prop in t ? t[prop as "auth"] : chain) }) };
});

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
// NativeWind s'e lexon tailwind.config në jest (darkMode: "class"), ndaj tema vendoset pa të.
jest.mock("nativewind", () => ({
  ...jest.requireActual("nativewind"),
  useColorScheme: () => ({ colorScheme: "light", setColorScheme: () => {}, toggleColorScheme: () => {} }),
}));
// expo-video kërkon modulin native qysh në import.
jest.mock("expo-video", () => {
  const RN = require("react-native");
  const player = { play() {}, pause() {}, replace() {}, release() {}, addListener: () => ({ remove() {} }), muted: true, loop: false, playing: false };
  return { VideoView: RN.View, useVideoPlayer: () => player, createVideoPlayer: () => player };
});
jest.mock("moti", () => {
  const RN = require("react-native");
  return { MotiView: RN.View, MotiText: RN.Text, MotiImage: RN.Image, MotiPressable: RN.Pressable, AnimatePresence: ({ children }: { children: unknown }) => children };
});

/** Navigimi: router-i regjistron ku u tentua të shkohej; params-at i vendos testi me setParams(). */
jest.mock("expo-router", () => {
  const React = require("react");
  const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismiss: jest.fn(), setParams: jest.fn(), canGoBack: () => true };
  const mockParams = { current: {} as Record<string, string> };
  const Stub = Object.assign(({ children }: { children?: unknown }) => children ?? null, { Screen: () => null });
  return {
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams.current,
    useGlobalSearchParams: () => mockParams.current,
    usePathname: () => "/",
    useSegments: () => [],
    useIsFocused: () => true,
    useNavigation: () => ({ setOptions: () => {}, addListener: () => () => {}, isFocused: () => true }),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    Link: Stub,
    Redirect: () => null,
    Stack: Stub,
    Tabs: Stub,
    __params: mockParams,
  };
});

export const router = (): Record<string, jest.Mock> => require("expo-router").router;
export const setParams = (p: Record<string, string>) => { require("expo-router").__params.current = p; };

// Çdo ekran mbyllet pas testit, si kur largohesh prej tij: kohëmatësit dhe abonimet duhet të ndalen.
const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  while (mounted.length) act(() => mounted.pop()!.unmount());
});

/** Ekrani brenda provider-ave; pret që ngarkimi nga ruajtja dhe pyetjet "pa rrjet" të mbarojnë. */
export async function renderScreen(element: ReactElement): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <LanguageProvider>
        <AppStateProvider>
          <ToastProvider>{element}</ToastProvider>
        </AppStateProvider>
      </LanguageProvider>
    );
  });
  mounted.push(r);
  // Disa cikle: hydrate nga AsyncStorage, pastaj efektet që nisin pyetjet.
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((ok) => setTimeout(ok, 0)); });
  return r;
}

/** Gjithë teksti i dukshëm, me radhë, për të kontrolluar çfarë shfaqet dhe ku. Fushat e shkrimit dalin si "⌨ <placeholder>". */
export function visibleText(root: ReactTestInstance): string[] {
  return root
    .findAll((n) => n.type === Text || n.type === TextInput, { deep: false })
    .map((n) => (n.type === TextInput ? `⌨ ${n.props.placeholder ?? ""}` : flatten(n.props.children)))
    .filter(Boolean);
}

/** Butoni (çdo element me onPress) që përmban tekstin e dhënë. */
export function button(root: ReactTestInstance, label: string): ReactTestInstance {
  const hits = root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).includes(label), { deep: false });
  if (!hits.length) throw new Error(`S'u gjet butoni "${label}"`);
  return hits[hits.length - 1];
}
function flatten(c: unknown): string {
  if (c == null || typeof c === "boolean") return "";
  if (Array.isArray(c)) return c.map(flatten).join("");
  if (typeof c === "string" || typeof c === "number") return String(c);
  return "";
}
