/* eslint-disable @typescript-eslint/no-require-imports -- fabrikat e jest.mock ekzekutohen para importeve, ndaj përdorin require() */
/**
 * Ndihmës për testet e ekraneve: ekrani i vërtetë brenda provider-ave të vërtetë (gjuha, state-i, toast),
 * siç i mbështjell app/_layout.tsx. Mock-ohet vetëm bota e jashtme: Supabase (si pa rrjet, ose me përgjigjet
 * që vendos testi me fakeSupabase()), ruajtja, navigimi dhe animacionet. Importoje E PARA te testi, që mock-et të vendosen para ekranit.
 */
import { type ReactElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { Text, TextInput } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { AppStateProvider } from "@/lib/state/AppStateContext";
import { ToastProvider } from "@/lib/toast/ToastContext";

jest.mock("@/lib/supabase/client", () => {
  // Pa përgjigje të vendosur nga testi, çdo pyetje kthen këtë: si telefon pa rrjet.
  const OFFLINE = { data: null, error: { message: "TypeError: Network request failed", code: "" }, count: null };
  // Përgjigjet që vendos testi (rpc sipas emrit, tabelat sipas emrit); çdo thirrje regjistrohet.
  const fake = {
    rpc: {} as Record<string, (args: Record<string, unknown>) => unknown>,
    tables: {} as Record<string, unknown>,
    calls: [] as { kind: "rpc" | "from"; name: string; args?: Record<string, unknown> }[],
    session: null as null | { user: { id: string; email?: string; app_metadata?: Record<string, unknown> } },
  };
  const answer = (v: unknown) => (v === undefined ? OFFLINE : { data: v, error: null, count: Array.isArray(v) ? v.length : null });
  // Zinxhir: from().select().eq()... dhe në fund `await` kthen përgjigjen.
  const chain = (result: () => unknown): unknown => {
    const p: unknown = new Proxy(function () {}, {
      get: (_t, prop) => (prop === "then" ? (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve().then(result).then(ok, ko) : p),
      apply: () => p,
    });
    return p;
  };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: fake.session }, error: null }),
      getUser: async () => ({ data: { user: fake.session?.user ?? null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      startAutoRefresh: () => {},
      stopAutoRefresh: () => {},
      signOut: async () => ({ error: null }),
    },
    rpc: (name: string, args: Record<string, unknown> = {}) => {
      fake.calls.push({ kind: "rpc", name, args });
      return chain(() => (fake.rpc[name] ? answer(fake.rpc[name](args)) : OFFLINE));
    },
    from: (name: string) => {
      fake.calls.push({ kind: "from", name });
      return chain(() => (name in fake.tables ? answer(fake.tables[name]) : OFFLINE));
    },
  };
  return {
    supabase: new Proxy(client, { get: (t, prop) => (prop in t ? t[prop as keyof typeof t] : chain(() => OFFLINE)) }),
    __fake: fake,
  };
});

type FakeSupabase = {
  rpc: Record<string, (args: Record<string, unknown>) => unknown>;
  tables: Record<string, unknown>;
  calls: { kind: "rpc" | "from"; name: string; args?: Record<string, unknown> }[];
  /** null = pa llogari. */
  session: null | { user: { id: string; email?: string; app_metadata?: Record<string, unknown> } };
};
/** Përgjigjet e Supabase-it për testin aktual; pastrohen pas çdo testi. */
export const fakeSupabase = (): FakeSupabase => require("@/lib/supabase/client").__fake;

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("@react-native-community/netinfo", () => require("@react-native-community/netinfo/jest/netinfo-mock.js"));
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
// Mock-u zyrtar s'e ka useFrameCallback (shiriti i markave): një cikël që s'nis kurrë.
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  useFrameCallback: () => ({ setActive: () => {}, isActive: false, callbackId: 0 }),
}));
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
  const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismiss: jest.fn(), setParams: jest.fn(), canGoBack: () => true, canDismiss: () => false };
  const mockParams = { current: {} as Record<string, string> };
  const mockPath = { current: "/" };
  const Stub = Object.assign(({ children }: { children?: unknown }) => children ?? null, { Screen: () => null });
  return {
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams.current,
    useGlobalSearchParams: () => mockParams.current,
    usePathname: () => mockPath.current,
    useSegments: () => [],
    useIsFocused: () => true,
    useNavigation: () => ({ setOptions: () => {}, addListener: () => () => {}, isFocused: () => true }),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    useScrollToTop: () => {},
    Link: Stub,
    Redirect: () => null,
    Stack: Stub,
    Tabs: Stub,
    __params: mockParams,
    __path: mockPath,
  };
});

export const router = (): Record<string, jest.Mock> => require("expo-router").router;
export const setParams = (p: Record<string, string>) => { require("expo-router").__params.current = p; };
export const setPathname = (p: string) => { require("expo-router").__path.current = p; };

// Çdo ekran mbyllet pas testit, si kur largohesh prej tij: kohëmatësit dhe abonimet duhet të ndalen.
const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  while (mounted.length) act(() => mounted.pop()!.unmount());
  const fake = fakeSupabase();
  fake.rpc = {};
  fake.tables = {};
  fake.calls = [];
  fake.session = null;
  setPathname("/");
  await require("@react-native-async-storage/async-storage").clear();
});

/** Telefon 390×844, pa prerje ekrani. */
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

/** Ekrani brenda provider-ave; pret që ngarkimi nga ruajtja dhe pyetjet "pa rrjet" të mbarojnë. */
export async function renderScreen(element: ReactElement): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <LanguageProvider>
          <AppStateProvider>
            <ToastProvider>{element}</ToastProvider>
          </AppStateProvider>
        </LanguageProvider>
      </SafeAreaProvider>
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
