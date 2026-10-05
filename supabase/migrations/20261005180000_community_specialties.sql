-- Komuniteti: mjekët dhe ekspertët ndahen në reparte (pediatër, gjinekolog/e, ortoped, psikolog/e, ...).
--   1) `community_specialties`: lista e repartave (e redaktueshme nga admini; app-i ka listë rezervë po të mungojë).
--   2) `community_experts.specialty_key` dhe `expert_applications.specialty_key`: reparti i ekspertit/aplikimit.
--      Eksperët dhe aplikimet ekzistuese klasifikohen sipas tekstit të vjetër ("Pediatër", "Nutricionist", ...).
--   3) `community_feed.author_specialty`: reparti i autorit te çdo postim (për emblemën dhe filtrin). Kolonë e re në fund,
--      pjesa tjetër e pamjes mbetet saktësisht e njëjtë.
--   4) `approve_expert_application`: aprovimi në një transaksion (aplikimi + ekspert te drejtoria) me zgjedhjen e repartit.
--      Vlerësimi fillestar është 0 (jo 5.0 i shpikur): app-i e fsheh vlerësimin derisa të ketë vlerësime të vërteta.
-- Shtesë e vogël; s'fshin asgjë dhe s'ndryshon të drejtat e tabelave ekzistuese.

begin;

create table if not exists public.community_specialties (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null,
  label_en text not null,
  emoji text not null default '🩺',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.community_specialties enable row level security;
drop policy if exists community_specialties_public_read on public.community_specialties;
create policy community_specialties_public_read on public.community_specialties for select using (true);
drop policy if exists community_specialties_admin_write on public.community_specialties;
create policy community_specialties_admin_write on public.community_specialties
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.community_specialties (key, label, label_en, emoji, sort_order) values
  ('pediatrician',       'Pediatër',                    'Pediatrician',           '🩺', 10),
  ('neonatologist',      'Neonatolog/e',                'Neonatologist',          '👶', 20),
  ('gynecologist',       'Gjinekolog/e',                'Gynecologist',           '🤰', 30),
  ('midwife',            'Mami',                        'Midwife',                '🏥', 40),
  ('orthopedist',        'Ortoped',                     'Orthopedist',            '🦴', 50),
  ('psychologist',       'Psikolog/e',                  'Psychologist',           '🧠', 60),
  ('psychiatrist',       'Psikiatër/e',                 'Psychiatrist',           '🧩', 70),
  ('neurologist',        'Neurolog/e',                  'Neurologist',            '⚡', 80),
  ('dermatologist',      'Dermatolog/e',                'Dermatologist',          '🧴', 90),
  ('ent',                'Otorinolaringolog/e (ORL)',   'ENT specialist',         '👂', 100),
  ('ophthalmologist',    'Okulist/e',                   'Ophthalmologist',        '👁️', 110),
  ('allergist',          'Alergolog/e',                 'Allergist',              '🤧', 120),
  ('gastroenterologist', 'Gastroenterolog/e',           'Gastroenterologist',     '🍽️', 130),
  ('cardiologist',       'Kardiolog/e',                 'Cardiologist',           '❤️', 140),
  ('endocrinologist',    'Endokrinolog/e',              'Endocrinologist',        '⚕️', 150),
  ('pediatric_dentist',  'Stomatolog/e pediatrik/e',    'Pediatric dentist',      '🦷', 160),
  ('nutritionist',       'Nutricionist/e',              'Nutritionist',           '🥦', 170),
  ('lactation',          'Konsulent/e gjidhënieje',     'Lactation consultant',   '🤱', 180),
  ('sleep_coach',        'Trajner/e gjumi',             'Sleep coach',            '😴', 190),
  ('physiotherapist',    'Fizioterapeut/e',             'Physiotherapist',        '🤸', 200),
  ('speech_therapist',   'Logoped/e',                   'Speech therapist',       '🗣️', 210),
  ('other',              'Specialitet tjetër',          'Other specialty',        '⚕️', 999)
on conflict (key) do nothing;

alter table public.community_experts
  add column if not exists specialty_key text references public.community_specialties (key) on update cascade on delete set null;
alter table public.expert_applications
  add column if not exists specialty_key text references public.community_specialties (key) on update cascade on delete set null;
create index if not exists community_experts_specialty_idx on public.community_experts (specialty_key);
create index if not exists community_posts_expert_idx on public.community_posts (created_at desc) where author_is_expert;

-- Klasifikimi i të dhënave ekzistuese sipas tekstit të vjetër të specializimit.
update public.community_experts set specialty_key = case lower(btrim(kind))
    when 'pediatër' then 'pediatrician'
    when 'nutricionist' then 'nutritionist'
    when 'konsulente gjidhënieje' then 'lactation'
    when 'psikolog fëmijësh' then 'psychologist'
    when 'trajner gjumi' then 'sleep_coach'
    else null end
  where specialty_key is null;
update public.expert_applications set specialty_key = case lower(btrim(specialization))
    when 'pediatër' then 'pediatrician'
    when 'nutricionist' then 'nutritionist'
    when 'konsulente gjidhënieje' then 'lactation'
    when 'psikolog fëmijësh' then 'psychologist'
    when 'trajner gjumi' then 'sleep_coach'
    else null end
  where specialty_key is null;

-- Rrjedha: e njëjta pamje, me kolonën e re `author_specialty` në fund.
create or replace view public.community_feed with (security_invoker = true) as
 select p.id,
    p.author_id,
    p.author_name,
    p.author_initial,
    p.author_is_expert,
    p.accent,
    p.kind,
    p.text,
    p.tag,
    p.icon,
    p.group_id,
    g.name as group_name,
    p.created_at,
    p.updated_at,
    p.like_count::bigint as like_count,
    p.comment_count::bigint as comment_count,
    p.media,
    (select e.specialty_key from public.community_experts e where e.user_id = p.author_id) as author_specialty
   from public.community_posts p
     left join public.community_groups g on g.id = p.group_id
  where not (exists ( select 1
           from public.community_blocks b
          where b.blocker_id = (( select auth.uid() as uid)) and b.blocked_id = p.author_id))
    and (p.author_id = (( select auth.uid() as uid)) or p.open_report_count < 3);

-- Aprovimi i eksperti: një transaksion, vetëm admini; reparti zgjidhet këtu (parazgjedhja: ai i aplikimit).
create or replace function public.approve_expert_application(p_application uuid, p_specialty text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.expert_applications%rowtype;
  v_key text;
  v_label text;
  v_expert uuid;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Vetëm administratori mund ta aprovojë një ekspert.';
  end if;
  select * into v_app from public.expert_applications where id = p_application for update;
  if v_app.id is null then
    raise exception 'Aplikimi nuk u gjet.';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Ky aplikim është shqyrtuar tashmë.';
  end if;

  v_key := coalesce(nullif(btrim(p_specialty), ''), v_app.specialty_key);
  if v_key is not null then
    select label into v_label from public.community_specialties where key = v_key;
    if v_label is null then
      raise exception 'Reparti nuk njihet.';
    end if;
  end if;

  update public.expert_applications
     set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), specialty_key = coalesce(v_key, specialty_key)
   where id = v_app.id;

  insert into public.community_experts (user_id, name, kind, bio, experience_years, languages, rating, review_count, icon, accent, specialty_key)
  values (v_app.user_id, v_app.full_name, coalesce(v_label, v_app.specialization), v_app.bio, v_app.experience_years, array['Shqip'], 0, 0, 'shield', 'olive', v_key)
  on conflict (user_id) do update
    set name = excluded.name, kind = excluded.kind, bio = excluded.bio,
        experience_years = excluded.experience_years, specialty_key = excluded.specialty_key
  returning id into v_expert;

  return v_expert;
end;
$$;
revoke all on function public.approve_expert_application(uuid, text) from public, anon;
grant execute on function public.approve_expert_application(uuid, text) to authenticated;

commit;
