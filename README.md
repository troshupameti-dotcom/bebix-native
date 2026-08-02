# Bebix — React Native (Expo)

Native iOS/Android port of Bebix, built with Expo + Expo Router + TypeScript +
NativeWind (Tailwind for React Native) + Moti (animations) + Supabase Auth.

This replaces the earlier Next.js build — see "Why React Native instead of
Next.js" below if you're wondering why the stack changed.

## Expo SDK 54 migration (from SDK 51)

This project was upgraded from Expo SDK 51 to **SDK 54** (React Native
0.81, React 19.1) — dependency/config migration only, **no UI or
feature changes**. What actually changed:

### Package versions
Every `expo-*` package, `react`, `react-native`, and the React Native
community packages (`react-native-reanimated`, `-screens`,
`-gesture-handler`, `-safe-area-context`, `-svg`, async-storage,
datetimepicker) were bumped to their SDK 54-compatible versions in
`package.json`.

**⚠️ Required final step:** exact patch versions for a couple of
packages (`expo-image-picker`, `expo-apple-authentication`,
`expo-auth-session`, `expo-print`, `expo-sharing`, `react-native-svg`)
shift frequently as Expo ships patches. After `npm install`, run:
```bash
npx expo install --fix
npx expo-doctor
```
`expo install --fix` is Expo's own authoritative source for exact
compatible versions — it will correct anything that's drifted since
this migration was written. `expo-doctor` flags any remaining
incompatibilities before you run the app.

### The one deliberate exception: Reanimated stays on v3, not v4
SDK 54's default recommendation is `react-native-reanimated ~4.1.0`.
**This project intentionally pins `~3.17.5` instead.** Reason: NativeWind
(used for every screen's styling) does not yet support Reanimated v4 —
upgrading would have broken styling across the entire app, which
violates "don't change the UI or features." Reanimated v3 fully
supports the New Architecture that Expo Go SDK 54 requires, so nothing
is lost — this is Expo's own documented guidance for NativeWind users,
not a workaround. Revisit this pin once NativeWind ships v5 with
Reanimated v4 support.

### Config changes
- **`app.json`**: the top-level `splash` key (deprecated since SDK 52)
  was migrated to the `expo-splash-screen` config plugin — same visual
  result, no deprecation warnings from `expo-doctor`.
- **`newArchEnabled: true`** added explicitly — the New Architecture is
  what Expo Go SDK 54 runs regardless, so this makes the project config
  match reality instead of leaving it implicit.
- Android edge-to-edge is enabled unconditionally by the OS in SDK 54
  (it can no longer be toggled), so no `androidStatusBar`/edge-to-edge
  keys were added — there's nothing left to configure.
- `babel.config.js` / `metro.config.js` are unchanged: both were
  already correct for the Reanimated v3 + NativeWind track (v3 still
  needs the explicit `react-native-reanimated/plugin` babel entry —
  only a v4 upgrade would make `babel-preset-expo` handle that
  automatically).

### Code changes (compatibility only, zero behavior change)
- **`lib/export.ts`**: SDK 54 made `expo-file-system`'s default export
  a new object-oriented `File`/`Directory` API. This file used the
  older functional API (`FileSystem.cacheDirectory`,
  `.writeAsStringAsync`), which still exists byte-for-byte identical
  under `expo-file-system/legacy` — one import line changed, nothing
  else.
- Everything else (React 19, RN 0.81) needed no code changes: the
  codebase doesn't use `defaultProps` on function components, string
  refs, or any other pattern React 19 removed, and no file imports
  `react-native-reanimated` directly (only via Moti + the babel
  plugin), so the v3/v4 API differences never surface in app code.
- Double-checked `expo-image-picker` calls in `moments.tsx` and
  `settings.tsx`: both already use the current `mediaTypes: ["images"]`
  array form rather than the deprecated `MediaTypeOptions` enum, so no
  change was needed there.

### Verifying nothing broke
After `npm install && npx expo install --fix`, run `npx expo start`
and open in the latest Expo Go on iOS — every screen, animation, form,
and interaction should behave exactly as before. If anything looks
different, it's a dependency-resolution issue to fix, not an
intentional change.

## Setup

```bash
npm install
cp .env.example .env
# fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) to run it on a real device, or
press `i` / `a` for a simulator.

## Why React Native instead of Next.js

Next.js is a **web** framework. Even wrapped with Capacitor for an App
Store listing, it renders inside a WebView — noticeably short of native
for exactly the things Bebix needs most: camera roll access, native
share, phone calls, smooth 60fps gestures, and that "Apple Health"-level
polish from the brief. React Native compiles to real native UI, so it's
the right foundation for shipping to the App Store / Google Play.

The Next.js build isn't wasted — the design tokens, screen structure,
component API shapes (`useAppState()`, `useTranslation()`, etc.) all
carried over 1:1, which is why this port went quickly.

## Project status

| Area                              | Status                                        |
| ---------------------------------- | ---------------------------------------------- |
| Design tokens (colour/type)         | ✅ cream/olive/orange + Fraunces/Inter          |
| Auth: Welcome/Login/Signup          | ✅ Done, wired to Supabase Auth                 |
| App shell: tabs + routing + state    | ✅ Done                                         |
| **Baby module (core of the app)**   | 🔒 **Frozen at v1.0 — bug fixes only, see below** |
| Home                                | ⏳ Stub only — next up                          |
| Shop / Community / More             | ⏳ Stub only                                    |

## Baby module

The core of the app. A native stack (`app/(main)/baby/`) rooted at the
Profile hub, with Feeding/Sleep/Diaper/Growth/Vaccinations/Settings
pushed on top:

```
app/(main)/baby/
  _layout.tsx        Stack navigator (native push/pop)
  index.tsx           Profile hub: segmented tabs (Profile/Timeline/Health/Milestones)
  feeding.tsx          Log breast/bottle/solid feedings
  sleep.tsx            Start/end sleep sessions, running duration
  diaper.tsx           One-tap wet/dirty/both logging
  growth.tsx           Weight/height line chart (hand-drawn SVG) + history + add measurement
  vaccinations.tsx     Schedule with done/upcoming/overdue status, mark-as-done
  settings.tsx         Edit photo/name/DOB/gender, danger-zone reset
```

**Profile tab** houses Growth Summary (editable stat cards), Quick
Actions (editable icon grid linking to the other screens), and the baby
card (photo/name/age, computed live from date of birth).
**Timeline tab** is a fully editable event list (add/remove/rename).
**Health tab** holds Medical Info (editable rows) plus a link into
Vaccinations. **Milestones tab** is a toggleable achievement grid.

Every editable section follows the same pattern: an Edit/Done toggle
reveals a subtle iOS-style wiggle + red remove badges on existing items,
and an Add tile opens a shared bottom sheet (`components/ui/BottomSheet.tsx`
+ `components/baby/PickerSheetContent.tsx`) listing not-yet-added presets
plus a "add something else" custom-entry form. This one pair of
components powers adding to Growth stats, Quick actions, Medical info,
Milestones, and Timeline events — new sections should reuse it rather
than building bespoke pickers.

All Baby module data types and demo seed data live in
`lib/state/babyTypes.ts`; actions live in `lib/state/AppStateContext.tsx`
under the `baby.*` namespace (`baby.addGrowthStat`, `baby.toggleMilestone`,
`baby.addFeedingEntry`, etc.) — see that file for the full list.

## Baby module — refined to production quality

Beyond the initial build, this pass added the systems that make the
module feel "flagship" rather than "functional":

**Universal edit system.** Every record (feeding, sleep, diaper, growth
measurement, vaccine, moment, medical record) opens the same
`RecordSheet` component on tap: fields are always editable inline, with
a consistent Duplicate / Share / Delete footer. Deleting never destroys
data outright — every list uses a soft-delete (`deletedAt`) pattern, and
`ToastProvider` shows a "Deleted · Undo" toast for ~4 seconds after every
delete. A parent can never lose data to a mis-tap.

**Haptics.** `lib/haptics.ts` wraps `expo-haptics` with semantic calls
(`haptics.tap()`, `.select()`, `.success()`, `.warning()`) used across
every meaningful interaction — tab switches, saves, deletes, marking a
vaccine done, toggling a milestone.

**Expanded data models** (`lib/state/babyTypes.ts`): Feeding now
supports 6 types with type-specific fields (side/duration for breast,
amount for bottle/formula/water/medicine, food category for solids) and
daily/weekly stats with average interval. Sleep supports pause/resume,
quality rating, and night-vs-nap. Diaper supports color/consistency.
Growth entries carry notes and compute BMI automatically; the chart
shows a simplified ±15% visual reference band (explicitly *not* real
WHO LMS percentile data — see the in-code comment before treating it as
clinically accurate). Vaccines carry description/doctor/clinic/batch
number/reminder toggle with automatic done/upcoming/due-today/overdue
status.

**New sections**: `moments.tsx` (photos via `expo-image-picker`,
notes, milestones, tags, favorites) and `medical.tsx` (symptoms,
temperature, medication, doctor visits, prescriptions, documents) —
both full CRUD on the same RecordSheet pattern.

**Expanded Baby Profile** (`settings.tsx`): nickname, blood type,
allergies, pediatrician, medical notes, parent notes, and a full
emergency-contacts list (add/remove).

**Unified Timeline** (Profile hub → Timeline tab): merges manual events,
feedings, sleep sessions, diaper changes, growth measurements, given
vaccines, and medical records into one chronological feed, with a
search box, kind filter chips, and Day/Week/Month range segments.

**AI-readiness.** Every log entry (feeding, sleep, diaper, growth,
vaccines, medical) is a flat, consistently-shaped, timestamped record
in `babyTypes.ts` — exactly the shape a future analysis feature would
want to query (e.g. "average feeding interval trending up over 2
weeks"). No AI logic exists yet; the data is simply structured so it
won't need reshaping later.

### Known simplifications (flagged honestly, not hidden)
- Growth chart reference band is a static ±15% visual guide, not a real
  WHO LMS percentile table — labelled as such in the UI and in code.
- `TimelineEvent.date` for manually-added events is still free-text
  (e.g. "Pritet së shpejti") rather than a true date, inherited from the
  original seed data — the unified timeline sorts these defensively but
  a future pass should migrate them to ISO dates for full accuracy.
- Settings currently covers baby-specific fields; app-level settings
  (theme/language/notifications/units/export/backup/privacy) belong in
  the "More" module, not yet built.
- Sleep pause/resume math is minute-granular (no sub-minute precision).

## Baby module — Version 1.0 (frozen)

**As of this batch, the Baby module is frozen.** Only bug fixes are
expected here going forward — new feature work continues in Home, Shop,
Community/AI, and Profile/More instead. This final batch closed the
gaps that made the module feel like a working prototype rather than a
shippable v1.0:

- **Archive** (`archivedAt`), distinct from Delete (`deletedAt`), on
  every record type. `app/(main)/baby/archive.tsx` lists everything
  archived across all 7 record kinds in one place, with Restore.
- **Audit Log** (`app/(main)/baby/audit-log.tsx`): every field-level
  edit — "Weight: 8.4 kg → 8.7 kg", "Diaper type: wet → dirty" — is
  recorded to `state.baby.auditLog` via the generic `diffAndTrack()`
  helper in `AppStateContext.tsx`, and browsable chronologically.
- **Edit History per record**: `RecordSheet` now shows "Created" /
  "Edited N×" / "Last modified: …" under every record's fields, backed
  by `createdAt` / `updatedAt` / `editCount` on the shared `Lifecycle`
  type every record extends.
- **Autosave**: closing any edit sheet — X button, backdrop tap, or
  hardware back — persists in-progress changes for existing records
  (new records still require the explicit Add button, so an accidental
  dismiss can't create empty clutter). "Never lose data to an
  accidental exit" now actually holds.
- **Smart Duplicate**: duplicating a feeding/sleep/diaper/moment never
  copies the original timestamp — it's logged as happening now.
- **Pin/Favorite** on Medical records (heart toggle in the record
  sheet; pinned records sort to the top of the list).
- **Bulk selection** in the unified Timeline: a "Select" toggle reveals
  checkboxes; a floating action bar handles Archive / Export / Share /
  Delete (with the same Undo-toast safety net) across a multi-type
  selection at once.
- **Export** (`app/(main)/baby/export.tsx`, `lib/export.ts`): PDF (via
  `expo-print`, styled HTML table), CSV, and JSON, each generated from
  every active record and shared via `expo-sharing`.

## Routing / auth logic

Same three-way branch as the web version, just enforced differently since
Expo Router has no server middleware:

| Visitor state                             | Lands on        |
| ------------------------------------------- | ---------------- |
| Valid Supabase session                       | `(main)/home`    |
| No session, onboarding seen before            | `(auth)/login`   |
| No session, first launch ever on this device  | `(auth)/welcome` |

- `app/index.tsx` makes this decision once, on cold start.
- `app/(main)/_layout.tsx` re-checks on every mount of the tab group and
  bounces to `/login` if the session disappears (e.g. token expiry) —
  this is the RN equivalent of the web build's `middleware.ts`.

## Things to wire up before shipping

1. **App icons/splash.** `app.json` points at `./assets/icon.png` etc. —
   add real Bebix artwork there (Expo will error on build without them).
2. **Real photography** for the welcome carousel — currently an Icon
   placeholder; swap for `expo-image` once assets exist.
3. **OAuth redirect URLs.** `SocialAuthRow.tsx` uses
   `Linking.createURL("auth/callback")` with the `bebix://` scheme
   (set in `app.json`) — register this redirect URL in your Supabase
   project's Auth settings.
4. **Sign in with Apple (App Store compliance).** The current Apple
   button reuses the generic OAuth web-browser flow. If you offer
   Google sign-in on iOS, Apple's guideline 4.8 requires Sign in with
   Apple too, via the native button — swap in `expo-apple-authentication`
   (`AppleAuthentication.signInAsync` → `supabase.auth.signInWithIdToken`)
   for full compliance; the package is already in `package.json`.
5. **`/forgot-password`, `/terms`, `/privacy`** — referenced but not
   built yet.
6. **"Remember me"** — UI-complete; Supabase's AsyncStorage-backed
   session persists regardless of this toggle today. True session-only
   behaviour needs a custom storage adapter swapped in at sign-in time.
7. **Photo picker permissions** — `app.json` already declares the
   camera/photo-library usage strings iOS requires; `expo-image-picker`
   is installed and ready for the Baby-profile photo upload screens.

## Data layer

`lib/state/AppStateContext.tsx` persists to `AsyncStorage` today (mirrors
the HTML prototype's in-memory state). Swap the reducer's actions for
Supabase reads/writes when your schema is ready — the `useAppState()`
hook API is designed to stay the same so screens won't need changes.

## Adding a new screen

1. Add translation keys to `lib/i18n/translations.ts` (`sq` + `en`).
2. Create `app/(main)/<screen>.tsx` (or a folder for sub-screens, e.g.
   `app/(main)/baby/feeding.tsx`), pulling data via `useAppState()` /
   `useTranslation()`.
3. Reuse `components/ui/Icon.tsx` — add any missing glyph to `GLYPHS`
   rather than introducing a second icon system.

## Design tokens

Colours, radii live in `tailwind.config.js` under `cream` / `ink` /
`olive` / `orange`. Shadows use `lib/shadows.ts` instead of Tailwind
`shadow-*` classes, since React Native has no CSS box-shadow — apply via
`style={shadows.soft}` on a `View`.
