import { BabyModuleState, initialBabyState, BloodType } from "./babyTypes";
import type { NotificationPrefs } from "@/lib/notifications/catalog";
import { initialNotificationPrefs } from "@/lib/notifications/catalog";

export type BabyGender = "girl" | "boy" | "other" | null;
export type ParentRelation = "mom" | "dad" | "guardian" | null;

export type BabyProfile = {
  babyName: string | null;
  nickname: string | null;
  babyDob: string | null;
  babyGender: BabyGender;
  babyPhoto: string | null;
  bloodType: BloodType;
  allergies: string;
  pediatrician: string;
  medicalNotes: string;
  parentNotes: string;
  parentName: string | null;
  relation: ParentRelation;
  parentPhoto: string | null;
};

export type FavoriteItem = {
  id: string;
  name: string;
  price: string;
  icon: string;
};

export type MemoryPhoto = {
  id: string;
  uri: string;
};

export type CartItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  icon: string;
  qty: number;
};

// Cilesimet e njoftimeve rrine te katalogu, bashke me celesat, parazgjedhjet
// dhe migrimin nga forma e vjeter. Ketu vetem ri-eksportohen, qe gjendja te
// mos kete nje kopje te dyte te se njejtes te vertete.
export type { NotificationPrefs };
export { initialNotificationPrefs };

export type AppState = {
  darkMode: boolean;
  profile: BabyProfile;
  favorites: FavoriteItem[];
  cartCount: number;
  cartItems: CartItem[];
  memories: MemoryPhoto[];
  baby: BabyModuleState;
  notificationPrefs: NotificationPrefs;
  /** Njoftimet e shënuara si të lexuara (id-të e lib/notifications/inbox.ts). */
  readNotificationIds: string[];
};

export const emptyProfile: BabyProfile = {
  babyName: null,
  nickname: null,
  babyDob: null,
  babyGender: null,
  babyPhoto: null,
  bloodType: null,
  allergies: "",
  pediatrician: "",
  medicalNotes: "",
  parentNotes: "",
  parentName: null,
  relation: null,
  parentPhoto: null,
};

export const initialAppState: AppState = {
  darkMode: false,
  profile: emptyProfile,
  favorites: [],
  cartCount: 0,
  cartItems: [],
  memories: [],
  baby: initialBabyState,
  notificationPrefs: initialNotificationPrefs,
  readNotificationIds: [],
};

export * from "./babyTypes";