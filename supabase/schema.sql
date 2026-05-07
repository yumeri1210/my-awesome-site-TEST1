create extension if not exists pgcrypto;

-- Create tables if they don't exist
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  avatar_url text,
  handle text unique not null default left(md5(gen_random_uuid()::text), 12),
  nickname text,
  creator_id text unique not null default left(md5(gen_random_uuid()::text), 12),
  bio text,
  is_public boolean not null default true,
  notify_on_message boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null default '',
  is_published boolean not null default false,
  is_private boolean not null default false,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  book_no integer not null default 0,
  is_published boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_no integer not null,
  title text not null,
  description text,
  is_published boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id, chapter_no)
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  section_no integer not null,
  title text not null,
  content text not null default '',
  is_published boolean not null default false,
  is_private boolean not null default false,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique(chapter_id, section_no)
);

-- Add missing columns safely
do $$
begin
  -- Profiles table
  if not exists (select from information_schema.columns where table_name = 'profiles' and column_name = 'creator_id') then
    alter table public.profiles add column creator_id text unique not null default left(md5(gen_random_uuid()::text), 12);
  end if;
  if not exists (select from information_schema.columns where table_name = 'profiles' and column_name = 'bio') then
    alter table public.profiles add column bio text;
  end if;
  if not exists (select from information_schema.columns where table_name = 'profiles' and column_name = 'handle') then
    alter table public.profiles add column handle text unique not null default left(md5(gen_random_uuid()::text), 12);
  end if;
  if not exists (select from information_schema.columns where table_name = 'profiles' and column_name = 'nickname') then
    alter table public.profiles add column nickname text;
  end if;
  if not exists (select from information_schema.columns where table_name = 'profiles' and column_name = 'is_public') then
    alter table public.profiles add column is_public boolean not null default true;
  end if;
  if not exists (select from information_schema.columns where table_name = 'profiles' and column_name = 'notify_on_message') then
    alter table public.profiles add column notify_on_message boolean not null default true;
  end if;

  -- Books table
  if not exists (select from information_schema.columns where table_name = 'books' and column_name = 'book_no') then
    alter table public.books add column book_no integer not null default 0;
  end if;
  if not exists (select from information_schema.columns where table_name = 'books' and column_name = 'description') then
    alter table public.books add column description text;
  end if;
  if not exists (select from information_schema.columns where table_name = 'books' and column_name = 'cover_url') then
    alter table public.books add column cover_url text;
  end if;
  if not exists (select from information_schema.columns where table_name = 'books' and column_name = 'is_published') then
    alter table public.books add column is_published boolean not null default false;
  end if;
  if not exists (select from information_schema.columns where table_name = 'books' and column_name = 'is_private') then
    alter table public.books add column is_private boolean not null default false;
  end if;
  if not exists (select from information_schema.columns where table_name = 'books' and column_name = 'updated_at') then
    alter table public.books add column updated_at timestamptz not null default now();
  end if;

  -- Chapters table
  if not exists (select from information_schema.columns where table_name = 'chapters' and column_name = 'description') then
    alter table public.chapters add column description text;
  end if;
  if not exists (select from information_schema.columns where table_name = 'chapters' and column_name = 'is_published') then
    alter table public.chapters add column is_published boolean not null default false;
  end if;
  if not exists (select from information_schema.columns where table_name = 'chapters' and column_name = 'is_private') then
    alter table public.chapters add column is_private boolean not null default false;
  end if;
  if not exists (select from information_schema.columns where table_name = 'chapters' and column_name = 'updated_at') then
    alter table public.chapters add column updated_at timestamptz not null default now();
  end if;

  -- Sections table
  if not exists (select from information_schema.columns where table_name = 'sections' and column_name = 'published_at') then
    alter table public.sections add column published_at timestamptz;
  end if;
end $$;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'books_author_id_fkey'
      and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_author_id_fkey
      foreign key (author_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_no integer not null,
  title text not null,
  description text,
  is_published boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id, chapter_no)
);
alter table public.chapters add column if not exists description text;
alter table public.chapters add column if not exists is_published boolean not null default false;
alter table public.chapters add column if not exists is_private boolean not null default false;
alter table public.chapters add column if not exists updated_at timestamptz not null default now();

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  section_no integer not null,
  title text not null,
  content text not null default '',
  is_published boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  view_count integer not null default 0,
  unique(chapter_id, section_no)
);
alter table public.sections add column if not exists is_published boolean not null default false;
alter table public.sections add column if not exists is_private boolean not null default false;
alter table public.sections add column if not exists updated_at timestamptz not null default now();
alter table public.sections add column if not exists published_at timestamptz;
alter table public.sections add column if not exists view_count integer not null default 0;

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, followed_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_anonymous boolean not null default false,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  content text not null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, section_id)
);

create index if not exists posts_author_id_idx on public.posts(author_id);
create index if not exists posts_is_published_idx on public.posts(is_published);
create index if not exists posts_view_count_idx on public.posts(view_count desc);

create index if not exists sections_view_count_idx on public.sections(view_count desc);
create index if not exists follows_follower_idx on public.follows(follower_id);
create index if not exists follows_followed_idx on public.follows(followed_id);
create index if not exists messages_receiver_idx on public.messages(receiver_id, is_read);
create index if not exists comments_section_idx on public.comments(section_id);
create index if not exists favorites_user_idx on public.favorites(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();

drop trigger if exists set_books_updated_at on public.books;
create trigger set_books_updated_at
before update on public.books
for each row
execute function public.set_updated_at();

drop trigger if exists set_chapters_updated_at on public.chapters;
create trigger set_chapters_updated_at
before update on public.chapters
for each row
execute function public.set_updated_at();

drop trigger if exists set_sections_updated_at on public.sections;
create trigger set_sections_updated_at
before update on public.sections
for each row
execute function public.set_updated_at();

create or replace function public.increment_post_view(p_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts
  set view_count = coalesce(view_count, 0) + 1
  where id = p_post_id and is_published = true;
$$;

create or replace function public.increment_section_view(p_section_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sections
  set view_count = coalesce(view_count, 0) + 1
  where id = p_section_id and is_published = true;
$$;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.sections enable row level security;
alter table public.follows enable row level security;
alter table public.messages enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_select_public" on public.profiles for select to anon, authenticated using (is_public = true);
create policy "profiles_upsert_own" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "posts_public_can_read_published" on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_public_can_read_published" on public.posts for select to anon, authenticated using (is_published = true or auth.uid() = author_id);
create policy "posts_insert_own" on public.posts for insert to authenticated with check (auth.uid() = author_id);
create policy "posts_update_own" on public.posts for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "books_read_public_or_owner" on public.books;
drop policy if exists "books_insert_own" on public.books;
drop policy if exists "books_update_own" on public.books;
drop policy if exists "books_delete_own" on public.books;
create policy "books_read_public_or_owner" on public.books for select to anon, authenticated using (is_published = true or auth.uid() = author_id);
create policy "books_insert_own" on public.books for insert to authenticated with check (auth.uid() = author_id);
create policy "books_update_own" on public.books for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "books_delete_own" on public.books for delete to authenticated using (auth.uid() = author_id);

drop policy if exists "chapters_read_public_or_owner" on public.chapters;
drop policy if exists "chapters_insert_owner" on public.chapters;
drop policy if exists "chapters_update_owner" on public.chapters;
drop policy if exists "chapters_delete_owner" on public.chapters;
create policy "chapters_read_public_or_owner" on public.chapters for select to anon, authenticated using (
  exists (select 1 from public.books b where b.id = chapters.book_id and (b.is_published = true or b.author_id = auth.uid()))
);
create policy "chapters_insert_owner" on public.chapters for insert to authenticated with check (
  exists (select 1 from public.books b where b.id = chapters.book_id and b.author_id = auth.uid())
);
create policy "chapters_update_owner" on public.chapters for update to authenticated using (
  exists (select 1 from public.books b where b.id = chapters.book_id and b.author_id = auth.uid())
) with check (
  exists (select 1 from public.books b where b.id = chapters.book_id and b.author_id = auth.uid())
);
create policy "chapters_delete_owner" on public.chapters for delete to authenticated using (
  exists (select 1 from public.books b where b.id = chapters.book_id and b.author_id = auth.uid())
);

drop policy if exists "sections_read_public_or_owner" on public.sections;
drop policy if exists "sections_insert_owner" on public.sections;
drop policy if exists "sections_update_owner" on public.sections;
drop policy if exists "sections_delete_owner" on public.sections;
create policy "sections_read_public_or_owner" on public.sections for select to anon, authenticated using (
  exists (
    select 1
    from public.chapters c
    join public.books b on b.id = c.book_id
    where c.id = sections.chapter_id and (b.is_published = true or b.author_id = auth.uid())
  )
);
create policy "sections_insert_owner" on public.sections for insert to authenticated with check (
  exists (
    select 1
    from public.chapters c
    join public.books b on b.id = c.book_id
    where c.id = sections.chapter_id and b.author_id = auth.uid()
  )
);
create policy "sections_update_owner" on public.sections for update to authenticated using (
  exists (
    select 1
    from public.chapters c
    join public.books b on b.id = c.book_id
    where c.id = sections.chapter_id and b.author_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.chapters c
    join public.books b on b.id = c.book_id
    where c.id = sections.chapter_id and b.author_id = auth.uid()
  )
);
create policy "sections_delete_owner" on public.sections for delete to authenticated using (
  exists (
    select 1
    from public.chapters c
    join public.books b on b.id = c.book_id
    where c.id = sections.chapter_id and b.author_id = auth.uid()
  )
);

drop policy if exists "follows_select_own" on public.follows;
drop policy if exists "follows_insert_own" on public.follows;
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_select_own" on public.follows for select to authenticated using (auth.uid() = follower_id);
create policy "follows_insert_own" on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "follows_delete_own" on public.follows for delete to authenticated using (auth.uid() = follower_id);

drop policy if exists "messages_select_own" on public.messages;
drop policy if exists "messages_insert_own" on public.messages;
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_select_own" on public.messages for select to authenticated using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "messages_insert_own" on public.messages for insert to authenticated with check (auth.uid() = sender_id or is_anonymous = true);
create policy "messages_update_own" on public.messages for update to authenticated using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);

create policy "comments_select_public" on public.comments for select to anon, authenticated using (
  exists (
    select 1 from public.sections s
    join public.chapters c on c.id = s.chapter_id
    join public.books b on b.id = c.book_id
    where s.id = comments.section_id and s.is_published = true and c.is_published = true and b.is_published = true
  )
);
create policy "comments_insert" on public.comments for insert to authenticated with check (
  auth.uid() = author_id or is_anonymous = true
);
create policy "comments_update_own" on public.comments for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "comments_delete_own" on public.comments for delete to authenticated using (auth.uid() = author_id);

drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_select_own" on public.favorites for select to authenticated using (auth.uid() = user_id);
create policy "favorites_insert_own" on public.favorites for insert to authenticated with check (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites for delete to authenticated using (auth.uid() = user_id);
