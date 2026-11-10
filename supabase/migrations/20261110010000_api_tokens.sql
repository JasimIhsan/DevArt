-- Personal access tokens for the DevArt MCP server (supabase/functions/mcp).
-- A token acts as its owner: the MCP function looks the owner up from the token's hash and only
-- ever touches that owner's files. Only the SHA-256 hash is stored; the token itself is shown once.
create extension if not exists pgcrypto with schema extensions;

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- First characters of the token, so people can tell their tokens apart. Not secret.
  prefix text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_tokens_owner on public.api_tokens (owner_id, created_at desc);

alter table public.api_tokens enable row level security;
create policy "api_tokens: read own" on public.api_tokens
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "api_tokens: revoke own" on public.api_tokens
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Column-level grants keep token_hash unreadable from the browser, and revoking is the only edit allowed.
revoke all on public.api_tokens from anon, authenticated;
grant select (id, name, prefix, created_at, last_used_at, revoked_at) on public.api_tokens to authenticated;
grant update (revoked_at) on public.api_tokens to authenticated;

-- Creates a token for the signed-in user and returns it. This is the only time the plain token exists.
create function public.create_api_token(p_name text)
returns table (id uuid, token text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  plain text;
  new_id uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if char_length(btrim(p_name)) not between 1 and 80 then raise exception 'Give the token a name of 1 to 80 characters'; end if;
  if (select count(*) from public.api_tokens t where t.owner_id = uid and t.revoked_at is null) >= 10 then
    raise exception 'You already have 10 active tokens. Revoke one first.';
  end if;
  plain := 'dva_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.api_tokens (owner_id, name, prefix, token_hash)
  values (uid, btrim(p_name), left(plain, 8), encode(extensions.digest(plain, 'sha256'), 'hex'))
  returning public.api_tokens.id into new_id;
  return query select new_id, plain;
end $$;
revoke all on function public.create_api_token(text) from public, anon;
grant execute on function public.create_api_token(text) to authenticated;
