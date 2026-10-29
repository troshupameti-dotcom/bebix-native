/**
 * Ngarkohet para çdo testi (package.json → jest.setupFiles).
 *
 * Reanimated 4.7.1 (Expo SDK 58) në jest përdor modulin e web-it (JSReanimated), por nisja për iOS/Android i
 * kërkon `setCSSEventHandler`, që aty hedh gabim, dhe çdo test që ngarkon Reanimated ndalej. Testet s'kanë
 * animacione CSS, ndaj thirrja bëhet pa efekt. Vlen vetëm kur testi e ngarkon vetë Reanimated-in.
 */
jest.mock("react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated", () => {
  const actual = jest.requireActual("react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated");
  return {
    ...actual,
    createJSReanimatedModule: () => Object.assign(actual.createJSReanimatedModule(), { setCSSEventHandler: () => {} }),
  };
});
