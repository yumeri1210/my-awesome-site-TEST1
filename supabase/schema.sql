create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  avatar_url text,
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

alter table public.posts add column if not exists author_id uuid;
alter table public.posts add column if not exists is_published boolean not null default false;
alter table public.posts add column if not exists is_private boolean not null default false;
alter table public.posts add column if not exists view_count integer not null default 0;
alter table public.posts add column if not exists updated_at timestamptz not null default now();
alter table public.posts add column if not exists published_at timestamptz;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_author_id_fkey'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_author_id_fkey
      foreign key (author_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.books add column if not exists author_id uuid;
alter table public.books add column if not exists is_published boolean not null default false;
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
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(book_id, chapter_no)
);
alter table public.chapters add column if not exists is_published boolean not null default false;

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  section_no integer not null,
  title text not null,
  content text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(chapter_id, section_no)
);
alter table public.sections add column if not exists is_published boolean not null default false;
alter table public.sections add column if not exists published_at timestamptz;

create index if not exists posts_author_id_idx on public.posts(author_id);
create index if not exists posts_is_published_idx on public.posts(is_published);
create index if not exists posts_view_count_idx on public.posts(view_count desc);

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

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.sections enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
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
