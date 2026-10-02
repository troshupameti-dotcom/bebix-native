-- Indeks per çelësin e huaj email_outbox.order_id (këshillë e Supabase advisor). Aplikuar tashmë.
create index if not exists email_outbox_order_idx on public.email_outbox (order_id);
