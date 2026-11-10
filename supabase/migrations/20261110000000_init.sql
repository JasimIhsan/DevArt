-- DevArt schema: one personal workspace per signed-in user. Teams and sharing come later.
-- Every row is private to its owner through row level security.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text not null default '',
  avatar_url text,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select, update on public.profiles to authenticated;

-- Creates the profile when someone signs in with Google for the first time.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- files ----------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Untitled' check (char_length(title) between 1 and 200),
  -- The editor's elements: an array of canvas elements (see src/core/types.ts).
  canvas jsonb not null default '[]'::jsonb check (jsonb_typeof(canvas) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Id of the same diagram in the old local SQLite database. Lets the import script be re-run safely.
  legacy_id text,
  unique (owner_id, legacy_id)
);
create index files_owner_recent on public.files (owner_id, updated_at desc) where deleted_at is null;
alter table public.files enable row level security;

create policy "files: read own" on public.files
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "files: create own" on public.files
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "files: update own" on public.files
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "files: delete own" on public.files
  for delete to authenticated using (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.files to authenticated;

-- Keeps updated_at current. An explicit new value (such as the import script's) is kept.
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger files_touch_updated_at
  before update on public.files
  for each row execute function public.touch_updated_at();
