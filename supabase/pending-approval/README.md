# Migrime që presin miratimin tënd

Këto dy skedarë janë gati, por **nuk janë aplikuar** në bazën e prodhimit.
Gjatë auditimit (28 shtator 2026) mjeti i sigurisë i Claude-it i ndaloi si
"ndryshim në prodhim", dhe vendimi mbetet te ti.

| Skedari | Çfarë rregullon | Rreziku nëse s'aplikohet |
| --- | --- | --- |
| `orders_and_stock.sql` | Stoku i produktit ndjek partnerët; `place_order` kontrollon emrin/telefonin/adresën, bashkon rreshtat e njëjtë, zbret stokun e produkteve pa partner, kufizon porositë në pritje, mbron nga dërgimi i dyfishtë; anulimi i porosisë e kthen stokun; "blerje e verifikuar" vetëm pas dorëzimit. | Produktet pa partner mund të porositen edhe kur tregohen "Pa stok"; anulimi nga admini e humb stokun; stoku që sheh klienti mund të jetë i gabuar. |
| `rls_initplan_rewrite.sql` | Rishkruan të gjitha politikat RLS që `auth.uid()` dhe kontrolli i adminit të llogariten një herë për kërkesë (advisor: `auth_rls_initplan`). | Vetëm shpejtësi: me shumë rreshta, listat e adminit dhe të partnerit ngadalësohen. |

## Si aplikohen

1. Hap Supabase → projekti **bebix app** → **SQL Editor**.
2. Ngjit përmbajtjen e skedarit dhe shtyp **Run**.
3. Pastaj zhvendose skedarin te `supabase/migrations/` me një emër me datë,
   që historiku i migrimeve të përputhet me bazën.

Ose thuaji Claude-it: "apliko migrimet në pending-approval" — dhe mirato
kërkesën kur të dalë.
