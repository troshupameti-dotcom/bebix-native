-- Porosia me kartë: emailet dhe njoftimi i adminit dalin PAS pagesës, jo kur klienti shtyp "Vazhdo te pagesa".
--   - Në krijim: porosia me kartë të pa paguar nuk dërgon asgjë (as email te klienti, as te admini, as njoftim në panel).
--   - Kur pagesa kalon në "paguar" (webhook-u i Stripe): del emaili "porosia u pranua" te klienti, emaili te admini dhe
--     njoftimi në panel. Çelësat e unicitetit (dedupe_key) s'lejojnë dublikata.
--   - Porosia me kartë që anulohet pa u paguar (pas 2 orësh) nuk i dërgon klientit email "u anulua": s'ka pasur porosi.
--   - "Në dorëzim" dhe transferta bankare punojnë si më parë (email në çastin e porosisë).
-- Shtesë e vogël; s'ndryshon të dhëna ekzistuese.

begin;

create or replace function public.enqueue_order_emails()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_email text;
  v_unpaid_card boolean;
begin
  begin
    v_email := lower(coalesce(nullif(btrim(new.email), ''), (select u.email from auth.users u where u.id = new.user_id)));
    v_unpaid_card := new.payment_method = 'card' and new.payment_status is distinct from 'paid';

    if tg_op = 'INSERT' then
      -- Me kartë, emailet presin pagesën (shih më poshtë).
      if not v_unpaid_card then
        -- Klienti me llogari: konfirmim në email-in e llogarisë. Mysafiri e merr më vonë, kur e jep email-in (set_order_email).
        if v_email is not null then
          insert into public.email_outbox (kind, order_id, audience, to_email, dedupe_key)
          values ('order_placed', new.id, 'customer', v_email, 'order_placed:' || new.id)
          on conflict do nothing;
        end if;
        insert into public.email_outbox (kind, order_id, audience, dedupe_key)
        values ('admin_new_order', new.id, 'admin', 'admin_new_order:' || new.id)
        on conflict do nothing;
      end if;
    else
      -- Pagesa me kartë u konfirmua: tani është një porosi e vërtetë.
      if new.payment_method = 'card' and new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
        if v_email is not null then
          insert into public.email_outbox (kind, order_id, audience, to_email, dedupe_key)
          values ('order_placed', new.id, 'customer', v_email, 'order_placed:' || new.id)
          on conflict do nothing;
        end if;
        insert into public.email_outbox (kind, order_id, audience, dedupe_key)
        values ('admin_new_order', new.id, 'admin', 'admin_new_order:' || new.id)
        on conflict do nothing;
      end if;

      if new.status is distinct from old.status and new.status in ('confirmed', 'shipped', 'delivered', 'cancelled') then
        -- Karta e pa paguar që anulohet vetë: klienti s'ka marrë asnjë konfirmim, ndaj s'merr as "u anulua".
        if v_email is not null and not (new.status = 'cancelled' and v_unpaid_card) then
          insert into public.email_outbox (kind, order_id, audience, to_email, dedupe_key)
          values ('status_' || new.status, new.id, 'customer', v_email, 'status:' || new.id || ':' || new.status)
          on conflict do nothing;
        end if;
      end if;
    end if;
  exception when others then
    -- Email-i s'duhet të rrëzojë kurrë porosinë.
    null;
  end;
  return new;
end;
$function$;

-- Emaili duhet të dëgjojë edhe ndryshimin e pagesës (më parë vetëm të statusit).
drop trigger if exists orders_enqueue_emails_status on public.orders;
create trigger orders_enqueue_emails_status
  after update of status, payment_status on public.orders
  for each row execute function public.enqueue_order_emails();

-- Njoftimi "Porosi e re" te paneli i adminit: me kartë del kur paguhet.
create or replace function public.notify_admin_new_order()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' and new.payment_method = 'card' and new.payment_status is distinct from 'paid' then
    return new;
  end if;
  insert into public.admin_notifications (type, title, body, payload)
  values (
    'new_order',
    'Porosi e re',
    coalesce(new.full_name, 'Klient') || ' · ' || to_char(new.total_price, 'FM999990.00') || ' € · ' || coalesce(new.city, ''),
    jsonb_build_object('order_id', new.id, 'city', new.city, 'total', new.total_price)
  );
  return new;
end
$function$;

drop trigger if exists orders_notify_admin_paid on public.orders;
create trigger orders_notify_admin_paid
  after update of payment_status on public.orders
  for each row
  when (new.payment_method = 'card' and new.payment_status = 'paid' and old.payment_status is distinct from 'paid')
  execute function public.notify_admin_new_order();

-- Mysafiri jep email-in pas porosisë: me kartë të pa paguar, konfirmimi presin pagesën (e dërgon trigger-i i mësipërm,
-- sepse email-i tashmë është te porosia).
create or replace function public.set_order_email(p_order_id uuid, p_client_ref uuid, p_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_id    uuid;
  v_unpaid_card boolean;
begin
  if v_email is null then
    return;
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    raise exception 'Email-i nuk është i vlefshëm.';
  end if;

  update public.orders set email = v_email
  where id = p_order_id and client_ref = p_client_ref and user_id is null
    and email is null and created_at > now() - interval '15 minutes'
  returning id, (payment_method = 'card' and payment_status is distinct from 'paid') into v_id, v_unpaid_card;

  if v_id is null or v_unpaid_card then
    return;
  end if;

  insert into public.email_outbox (kind, order_id, audience, to_email, dedupe_key)
  values ('order_placed', v_id, 'customer', v_email, 'order_placed:' || v_id)
  on conflict do nothing;
end;
$function$;

commit;
