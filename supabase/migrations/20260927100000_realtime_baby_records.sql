-- Realtime per historikun e bebit: telefoni dhe webi marrin njoftim sapo
-- e njejta llogari (ose partneri i shtepise) shkruan nje shenim, ne vend qe
-- te kontrollojne serverin cdo 30 sekonda.
--
-- Realtime zbaton RLS-ne per cdo abonent: politika baby_records_household
-- (can_access_baby_data) vendos kush e merr njoftimin, njesoj si per SELECT.
alter publication supabase_realtime add table public.baby_records;
