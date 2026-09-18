-- Mbeshtetje per fshirjen e llogarise (kerkese e Google Play dhe e GDPR-se).
--
-- Porosite NUK fshihen: te to varen `order_items`, fitimet e partnereve dhe
-- payouts. Ne vend te kesaj porosia shkeputet nga personi: `user_id` behet
-- null dhe te dhenat personale zevendesohen. Mbetet vetem fakti tregtar.
--
-- APLIKUAR TASHME ne projekt (version 20260918180130).

alter table public.orders alter column user_id drop not null;

comment on column public.orders.user_id is
  'Null = llogaria e klientit eshte fshire; porosia mbahet e anonimizuar per kontabilitet.';
