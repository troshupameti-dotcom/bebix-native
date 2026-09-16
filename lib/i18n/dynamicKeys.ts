/* eslint-disable @typescript-eslint/no-unused-vars -- tipet me _ jane kontrolle kompilimi, s'perdoren ne kod */
import type { TranslationKey } from "@/lib/i18n/translations";
import type { BabyGender } from "@/lib/state/types";
import type {
  BreastSide,
  DiaperType,
  FeedingType,
  MedicalRecordType,
  SleepQuality,
  VaccineStatus,
} from "@/lib/state/babyTypes";

/**
 * Disa ekrane e ndërtojnë çelësin në kohë xhirimi, p.sh.
 * `t(\`feeding_type_${entry.type}\` as never)`. Ai cast e heq kontrollin e
 * tipit, prandaj një çelës që mungon te translations.ts NUK del si gabim
 * kompilimi — del si tekst i papërpunuar në ekran ("feeding_type_formula").
 *
 * Ky file e rikthen kontrollin: `Assert<T>` pranon vetëm çelësa që ekzistojnë
 * vërtet te `translations.sq`. Nëse shtohet një vlerë e re te ndonjë nga
 * tipet më poshtë (p.sh. një `FeedingType` i ri) dhe s'i shtohet përkthimi,
 * `npx tsc --noEmit` dështon këtu, para se ta shohë përdoruesi.
 *
 * Nuk eksporton asgjë që xhirohet — janë vetëm kontrolle tipesh.
 */
type Assert<T extends TranslationKey> = T;

// medicine -> "feeding_type_medicine_short" (emër i shkurtër për listat)
type _FeedingTypeKeys = Assert<
  `feeding_type_${Exclude<FeedingType, "medicine">}` | "feeding_type_medicine_short"
>;

type _FeedingSideKeys = Assert<`feeding_side_${NonNullable<BreastSide>}`>;
type _DiaperTypeKeys = Assert<`diaper_type_${DiaperType}`>;
type _SleepQualityKeys = Assert<`sleep_quality_${NonNullable<SleepQuality>}`>;
type _VaccineStatusKeys = Assert<`vaccine_status_${VaccineStatus}`>;
type _MedicalTypeKeys = Assert<`medical_type_${MedicalRecordType}`>;
type _GenderKeys = Assert<`gender_${NonNullable<BabyGender>}`>;
