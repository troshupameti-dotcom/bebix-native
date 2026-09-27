import AsyncStorage from "@react-native-async-storage/async-storage";
import { claimLocalData, consumeRecoveryRequest, markRecoveryRequested } from "@/lib/auth/localDataOwner";

// jest i ngre këto mbi import-et.
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("claimLocalData", () => {
  it("hera e parë: të dhënat i kalojnë llogarisë së kyçur", async () => {
    await expect(claimLocalData("user-a")).resolves.toBe("claimed");
  });

  it("e njëjta llogari: asgjë s'ndryshon", async () => {
    await claimLocalData("user-a");
    await expect(claimLocalData("user-a")).resolves.toBe("same");
  });

  it("llogari tjetër në të njëjtin telefon: duhen pastruar", async () => {
    await claimLocalData("user-a");
    await expect(claimLocalData("user-b")).resolves.toBe("switched");
    // Pas pastrimit, pronari i ri mbahet mend.
    await expect(claimLocalData("user-b")).resolves.toBe("same");
  });
});

describe("linku i rikthimit të fjalëkalimit", () => {
  it("pranohet kur rikthimi u kërkua nga ky telefon", async () => {
    await markRecoveryRequested();
    await expect(consumeRecoveryRequest()).resolves.toBe(true);
  });

  it("refuzohet kur s'u kërkua nga ky telefon", async () => {
    await expect(consumeRecoveryRequest()).resolves.toBe(false);
  });

  it("përdoret vetëm një herë", async () => {
    await markRecoveryRequested();
    await consumeRecoveryRequest();
    await expect(consumeRecoveryRequest()).resolves.toBe(false);
  });

  it("skadon pas 2 orësh", async () => {
    await markRecoveryRequested();
    await expect(consumeRecoveryRequest(Date.now() + 3 * 60 * 60 * 1000)).resolves.toBe(false);
  });
});
