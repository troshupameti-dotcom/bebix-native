# Publikimi i Bebix-it

Bebix ka pesë rrugë publikimi që s'varen nga njëra-tjetra. Kur publikohen pa radhë, live mbetet gjysmë i
përditësuar (p.sh. app-i pret një funksion që baza s'e ka ende). Prandaj radha është gjithmonë kjo:

| # | Çfarë | Si | Kontrolli para |
|---|---|---|---|
| 1 | **SQL** (`supabase/migrations`) | Supabase → SQL Editor | Testi i migrimit kalon në CI (job `sql`) |
| 2 | **Edge Functions** (`supabase/functions`) | `npx supabase functions deploy <emri> --project-ref mkpayczhqmbpqwwxjtjf` | `stripe.test.mjs` kalon; `stripe-webhook` me `--no-verify-jwt` |
| 3 | **Web** (`bebix-web`) | push te `master` → Vercel | `npm run preflight` dhe CI e gjelbër |
| 4 | **Flag-et** (`EXPO_PUBLIC_*`) | EAS → Environment variables | Vlera të njëjta për preview dhe production |
| 5 | **App-i** | `eas build` | CI dhe **Android** të gjelbra për këtë commit |

Kodi që përdor një tabelë, kolonë ose funksion të ri del vetëm pasi hapi 1 të jetë bërë.

## Rregullat

- **Asnjë build pa CI të gjelbër.** Kontrollo `gh run list --limit 3`: duhet `success` për të dy workflow-t
  (`CI` dhe `Android`) te commit-i që ndërtohet. Build-i EAS ndalet vetë kur testet dështojnë.
- **Një temë për commit.** Migrimi dhe testi i tij hyjnë bashkë, në të njëjtin commit.
- **Çdo gabim i ndrequr merr test** që dështon pa ndreqjen. Teste të dobësuara ose të çaktivizuara s'pranohen.
- **Leje dhe plugin-e native:** lexo kodin native para se të bllokosh një leje. Job-i `Android` e hap app-in
  në Android 14 dhe dështon nëse rrëzohet.
- Lokalisht para push-it: `npm run preflight`.

## Kur quhet "i qëndrueshëm"

- `main` është gjithmonë e gjelbër (CI + Android).
- Sentry: të paktën 99.5% seanca pa rrëzim; asnjë rrëzim i ri në hapje.
- Asnjë gabim i ndrequr nuk rikthehet brenda 14 ditëve.
- Baza live përputhet me `supabase/migrations`, dhe Edge Functions live me kodin.
- Të pesë rrugët e publikimit janë në të njëjtin commit.
