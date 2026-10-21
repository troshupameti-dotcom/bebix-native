import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Pëlqimi për asistentin AI, për çdo llogari në këtë telefon. Apple (rregulli 5.1.2) dhe GDPR-i kërkojnë që prindi
 * ta dijë që pyetjet i dërgohen një AI-je të jashtme (Anthropic) dhe ta pranojë para përdorimit të parë.
 */
const key = (userId: string) => `bebix_ai_consent_v1:${userId}`;

export async function hasAiConsent(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) != null;
  } catch {
    return false;
  }
}

export async function giveAiConsent(userId: string): Promise<void> {
  await AsyncStorage.setItem(key(userId), new Date().toISOString()).catch(() => {});
}
