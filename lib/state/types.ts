import { BabyModuleState, initialBabyState, BloodType } from "./babyTypes";

export type BabyGender = "girl" | "boy" | "other" | null;
export type ParentRelation = "mom" | "dad" | "guardian" | null;

export type BabyProfile = {
  babyName: string | null;
  nickname: string | null;
  babyDob: string | null;
  babyGender: BabyGender;
  babyPhoto: string | null; // local URI for now, swap for Supabase Storage URL later
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

// ---------------------------------------------------------------------
// Community — local-only interaction state (likes/saves/joins/follows).
// Real cross-user data (other people's posts, comments, messages) needs
// Supabase tables later; this is what makes the local UI interactive
// today, mirroring the favorites/cartCount pattern above.
// ---------------------------------------------------------------------

export type CommunityState = {
  likedPostIds: string[];
  savedPostIds: string[];
  joinedGroupIds: string[];
  followedExpertIds: string[];
};

export const initialCommunityState: CommunityState = {
  likedPostIds: [],
  savedPostIds: [],
  joinedGroupIds: [],
  followedExpertIds: [],
};

// ---------------------------------------------------------------------
// Notification preferences — çelësa lokalë, të ruajtur. Kontrollojnë
// çfarë do të dërgohet KUR të lidhet push/email/SMS reale; deri atëherë
// thjesht ruajnë zgjedhjen e përdoruesit.
// ---------------------------------------------------------------------

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
  emergencyAlerts: true, // rekomandohet të mos çaktivizohet kurrë
};

export type AppState = {
  darkMode: boolean;
  profile: BabyProfile;
  favorites: FavoriteItem[];
  cartCount: number;
  memories: MemoryPhoto[];
  baby: BabyModuleState;
  community: CommunityState;
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
  memories: [],
  baby: initialBabyState,
  community: initialCommunityState,
  notificationPrefs: initialNotificationPrefs,
};

export * from "./babyTypes";