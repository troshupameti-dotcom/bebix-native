-- Njoftimi push "Porosia është nisur": "Paguan kur ta marrësh" vetëm kur paguhet në dorëzim.
-- Me kartë ose transfertë (e paguar paraprakisht) teksti s'e përmend pagesën.
-- E njëjta funksion si më parë, vetëm teksti i "shipped" varet nga mënyra e pagesës.

begin;

create or replace function public.notify_customer_order_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ref text := '#' || upper(left(new.id::text, 8));
  prepaid boolean := coalesce(new.payment_method, 'cod') <> 'cod';
  title text;
  body  text;
begin
  if new.status is not distinct from old.status or new.user_id is null then
    return new;
  end if;

  select * into title, body from (values
    ('confirmed', 'Porosia u konfirmua', 'Porosia ' || ref || ' u konfirmua dhe po përgatitet.'),
    ('shipped',   'Porosia është nisur', 'Porosia ' || ref || ' është nisur.' || case when prepaid then '' else ' Paguan kur ta marrësh.' end),
    ('delivered', 'Porosia u dorëzua',   'Porosia ' || ref || ' u dorëzua. Faleminderit!'),
    ('cancelled', 'Porosia u anulua',    'Porosia ' || ref || ' u anulua. Na shkruaj nëse nuk e prisje këtë.')
  ) as m(st, t, b) where m.st = new.status;

  if title is not null then
    perform public.enqueue_notification(
      new.user_id, 'shop_order', title, body,
      jsonb_build_object('orderId', new.id),
      'order:' || new.id || ':' || new.status
    );
  end if;

  -- Pas dorëzimit, një kërkesë e vetme për vlerësim, një ditë më vonë.
  if new.status = 'delivered' then
    perform public.enqueue_notification(
      new.user_id, 'shop_review_request',
      'Si ishte?',
      'Shkruaj dy fjalë për atë që more — prindërit e tjerë vendosin duke lexuar përvoja të vërteta.',
      jsonb_build_object('orderId', new.id),
      'review:' || new.id,
      now() + interval '1 day'
    );
  end if;

  return new;
end
$function$;

commit;
