-- ============================================================
-- 研途问道 · Supabase 建表脚本（可重复执行）
-- 用法：Supabase 项目 → SQL Editor → 整段粘贴 → Run
-- ============================================================

-- 1) 玩家档案：云存档 + 排行榜
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,                       -- 道号（加道友用，唯一）
  name text not null default '道友',
  realm text, form int default 0, score bigint default 0,
  attrs jsonb, data jsonb,                  -- data = 完整存档
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- 2) 好友关系
create table if not exists public.friends (
  id bigint generated always as identity primary key,
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',   -- pending / accepted
  created_at timestamptz default now(),
  unique(requester,addressee)
);
alter table public.friends enable row level security;

-- 3) 留言
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  body text not null, created_at timestamptz default now()
);
alter table public.messages enable row level security;

-- 4) 好友互助（浇水 / 组队）
create table if not exists public.helps (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, created_at timestamptz default now()
);
alter table public.helps enable row level security;

-- 排行榜视图
create or replace view public.leaderboard as
  select handle,name,realm,form,score,updated_at
  from public.profiles order by score desc nulls last;

-- 注册即自动建档（默认道号 dx + id 前8位，可在游戏里改）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,name,handle)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'name','道友'),
    'dx'||substr(replace(new.id::text,'-',''),1,8))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS：profiles 全员可读（排行榜/加道友），本人可写
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles for select using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert with check (auth.uid()=id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid()=id);

-- RLS：friends 当事双方可读，请求方可写
drop policy if exists "friends read" on public.friends;
create policy "friends read" on public.friends for select
  using (auth.uid()=requester or auth.uid()=addressee);
drop policy if exists "friends insert" on public.friends;
create policy "friends insert" on public.friends for insert with check (auth.uid()=requester);
drop policy if exists "friends update" on public.friends;
create policy "friends update" on public.friends for update
  using (auth.uid()=requester or auth.uid()=addressee);
drop policy if exists "friends delete" on public.friends;
create policy "friends delete" on public.friends for delete
  using (auth.uid()=requester or auth.uid()=addressee);

-- RLS：messages 收发双方可读，本人可发
drop policy if exists "msg read" on public.messages;
create policy "msg read" on public.messages for select
  using (auth.uid()=from_id or auth.uid()=to_id);
drop policy if exists "msg insert" on public.messages;
create policy "msg insert" on public.messages for insert with check (auth.uid()=from_id);

-- RLS：helps 双方可读，本人可发
drop policy if exists "helps read" on public.helps;
create policy "helps read" on public.helps for select
  using (auth.uid()=from_id or auth.uid()=to_id);
drop policy if exists "helps insert" on public.helps;
create policy "helps insert" on public.helps for insert with check (auth.uid()=from_id);
