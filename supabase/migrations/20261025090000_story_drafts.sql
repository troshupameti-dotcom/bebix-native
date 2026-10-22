-- Përralla e javës nga Claude: çdo të hënë funksioni `story-draft` shkruan një përrallë të re dhe e ruan si draft
-- (status 'draft', source 'ai'). Admini e lexon te Paneli → Përrallat, e ndryshon nëse duhet dhe e publikon; prindërit
-- s'e shohin para publikimit (RLS e migrimit 20261024090000 tregon vetëm 'published').
-- Ekzekutohet PAS 20261024090000_stories.sql. I sigurt për t'u ekzekutuar dy herë; s'fshin asgjë.

-- Kush e shkroi: 'editor' (njeri) ose 'ai' (Claude, para aprovimit të adminit).
alter table public.stories add column if not exists source text not null default 'editor';
alter table public.stories drop constraint if exists stories_source_check;
alter table public.stories add constraint stories_source_check check (source in ('editor', 'ai'));

-- Ilustrimi që vizaton Claude (SVG i thjeshtë, i pastruar në server); app-i e vizaton kur s'ka foto.
alter table public.stories add column if not exists cover_svg text;
alter table public.stories drop constraint if exists stories_cover_svg_len;
alter table public.stories add constraint stories_cover_svg_len check (cover_svg is null or char_length(cover_svg) <= 20000);

-- Ideja që i dha admini Claude-it për këtë përrallë (opsionale), për ta ditur pse u shkrua.
alter table public.stories add column if not exists ai_idea text;
alter table public.stories drop constraint if exists stories_ai_idea_len;
alter table public.stories add constraint stories_ai_idea_len check (ai_idea is null or char_length(ai_idea) <= 300);

-- Draftet e fundit për panelin e adminit.
create index if not exists stories_drafts_idx on public.stories (created_at desc) where status = 'draft';

-- Çdo të hënë në 06:00 UTC (08:00 në Kosovë/Shqipëri në verë, 07:00 në dimër). Funksioni vetë s'shkruan më shumë se
-- një përrallë në javë, edhe nëse thirret më shpesh. Vetëm kur pg_cron dhe pg_net ekzistojnë (si te ky projekt).
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule(
      'weekly-story-draft',
      '0 6 * * 1',
      $j$select net.http_post(url := 'https://mkpayczhqmbpqwwxjtjf.supabase.co/functions/v1/story-draft', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{"trigger": "cron"}'::jsonb);$j$
    );
  end if;
end
$cron$;
