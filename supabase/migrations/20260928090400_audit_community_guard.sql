-- Auditimi (28 shtator 2026): postimet dhe komentet s'mund te genjejne
-- per autorin.
--
-- Deri tani klienti vendoste vete `author_is_expert`, `author_name`,
-- `created_at` dhe `icon` te postimi. Me nje kerkese direkte, cilido mund:
--   - te postonte me shenjen "ekspert i verifikuar" pa qene i tille,
--   - te merrte emrin e nje mjeku te verifikuar,
--   - ta vendoste `created_at` ne vitin 2099, qe postimi te rrinte
--     pergjithmone ne krye te rrjedhes,
--   - te vendoste te `media` rruge skedaresh qe s'jane te tijat.
-- Tani keto i vendos baza: eksperti njihet nga `community_experts`, koha
-- eshte ajo e serverit, dhe fushat e autorit s'ndryshohen me UPDATE.

create or replace function public.community_author_name(p_author uuid, p_requested text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_expert_name text;
  v_name text := left(regexp_replace(btrim(coalesce(p_requested, '')), '\s+', ' ', 'g'), 60);
begin
  select name into v_expert_name from public.community_experts where user_id = p_author;
  if v_expert_name is not null then
    return v_expert_name;
  end if;
  if v_name = '' then
    return 'Prind';
  end if;
  if exists (select 1 from public.community_experts where lower(name) = lower(v_name)) then
    raise exception 'Ky emër i përket një eksperti të verifikuar. Zgjidh një emër tjetër te profili.';
  end if;
  return v_name;
end;
$$;

revoke execute on function public.community_author_name(uuid, text) from public, anon, authenticated;

create or replace function public.community_posts_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_expert boolean;
begin
  if tg_op = 'INSERT' then
    v_is_expert := exists (select 1 from public.community_experts where user_id = new.author_id);
    new.author_name := public.community_author_name(new.author_id, new.author_name);
    new.author_initial := upper(left(new.author_name, 1));
    new.author_is_expert := v_is_expert;
    new.icon := case when v_is_expert then 'shield' else 'sparkle' end;
    new.created_at := now();
    new.updated_at := now();
    if exists (
      select 1 from jsonb_array_elements(coalesce(new.media, '[]'::jsonb)) m
      where coalesce(m->>'path', '') not like new.author_id::text || '/%'
    ) then
      raise exception 'Skedarët e postimit duhet të jenë të ngarkuar nga ti.';
    end if;
    return new;
  end if;

  -- UPDATE: autori mund te ndryshoje tekstin, etiketen dhe median e vet;
  -- kush e shkroi dhe kur, jo.
  new.author_id := old.author_id;
  new.author_name := old.author_name;
  new.author_initial := old.author_initial;
  new.author_is_expert := old.author_is_expert;
  new.icon := old.icon;
  new.created_at := old.created_at;
  new.updated_at := now();
  if new.media is distinct from old.media and exists (
    select 1 from jsonb_array_elements(coalesce(new.media, '[]'::jsonb)) m
    where coalesce(m->>'path', '') not like old.author_id::text || '/%'
  ) then
    raise exception 'Skedarët e postimit duhet të jenë të ngarkuar nga ti.';
  end if;
  return new;
end;
$$;

revoke execute on function public.community_posts_guard() from public, anon, authenticated;

drop trigger if exists community_posts_guard on public.community_posts;
create trigger community_posts_guard before insert or update on public.community_posts
  for each row execute function public.community_posts_guard();

create or replace function public.community_comments_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author_name := public.community_author_name(new.author_id, new.author_name);
  new.created_at := now();
  if new.parent_id is not null and not exists (
    select 1 from public.community_comments c where c.id = new.parent_id and c.post_id = new.post_id
  ) then
    raise exception 'Përgjigja duhet të jetë te i njëjti postim.';
  end if;
  return new;
end;
$$;

revoke execute on function public.community_comments_guard() from public, anon, authenticated;

drop trigger if exists community_comments_guard on public.community_comments;
create trigger community_comments_guard before insert on public.community_comments
  for each row execute function public.community_comments_guard();
