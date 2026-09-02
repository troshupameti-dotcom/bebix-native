import { BabyModuleState, initialBabyState, BloodType } from "./babyTypes";

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

export type NotificationPrefs = {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  medicineReminders: boolean;
  vaccinationReminders: boolean;
  sleepReminders: boolean;
  feedingReminders: boolean;
  shoppingNotifications: boolean;
  deliveryUpdates: boolean;
  communityNotifications: boolean;
  aiRecommendations: boolean;
  marketing: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  emergencyAlerts: boolean;
};

export const initialNotificationPrefs: NotificationPrefs = {
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  medicineReminders: true,
  vaccinationReminders: true,
  sleepReminders: true,
  feedingReminders: true,
  shoppingNotifications: true,
  deliveryUpdates: true,
  communityNotifications: true,
  aiRecommendations: true,
  marketing: false,
  weeklyReports: true,
  monthlyReports: false,
  emergencyAlerts: true,
};

export type AppState = {
  darkMode: boolean;
  profile: BabyProfile;
  favorites: FavoriteItem[];
  cartCount: number;
  cartItems: CartItem[];
  memories: MemoryPhoto[];
  baby: BabyModuleState;
  notificationPrefs: NotificationPrefs;
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
};

export * from "./babyTypes";