import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_STATE_KEY, BABY_KEY_PREFIX, loadAppState, resetPersistenceCache, saveAppState } from "@/lib/state/persistence";
import { initialAppState, type AppState } from "@/lib/state/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

beforeEach(async () => {
  await AsyncStorage.clear();
  resetPersistenceCache();
});

describe("ruajtja në telefon", () => {
  it("çdo listë e bebit ruhet në çelësin e vet, dhe rilexohet e plotë", async () => {
    await saveAppState(initialAppState);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toContain(APP_STATE_KEY);
    expect(keys).toContain(`${BABY_KEY_PREFIX}feedingLog`);
    const main = JSON.parse((await AsyncStorage.getItem(APP_STATE_KEY))!);
    expect(main.baby).toBeUndefined();

    const { state, failed } = await loadAppState();
    expect(failed).toBe(false);
    expect(state?.baby?.feedingLog).toEqual([]);
  });

  it("shkruan vetëm listën që ndryshoi", async () => {
    await saveAppState(initialAppState);
    const multiSet = AsyncStorage.multiSet as jest.Mock;
    multiSet.mockClear();
    const next: AppState = { ...initialAppState, baby: { ...initialAppState.baby, diaperLog: [] } };
    await saveAppState(next);
    const written = (multiSet.mock.calls[0][0] as [string, string][]).map(([key]) => key);
    expect(written).toEqual([`${BABY_KEY_PREFIX}diaperLog`]);
  });

  it("formati i vjetër (gjithçka në një vlerë) lexohet ende", async () => {
    await AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify(initialAppState));
    const { state } = await loadAppState();
    expect(state?.baby?.timeline).toEqual([]);
  });

  it("një listë e prishur shënohet si dështim, që historiku të rimerret nga serveri", async () => {
    await AsyncStorage.setItem(`${BABY_KEY_PREFIX}feedingLog`, "{prishur");
    const { failed } = await loadAppState();
    expect(failed).toBe(true);
  });
});
