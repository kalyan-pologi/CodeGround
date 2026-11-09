create table if not exists public.practice_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank text not null,
  task_id text not null,
  starter_signature text not null,
  code text not null,
  stdin text not null default '',
  updated_at timestamptz not null default now(),
  constraint practice_drafts_bank_length check (char_length(bank) between 1 and 64),
  constraint practice_drafts_task_id_length check (char_length(task_id) between 1 and 128),
  constraint practice_drafts_code_size check (octet_length(code) <= 1000000),
  constraint practice_drafts_stdin_size check (octet_length(stdin) <= 1000000),
  unique (user_id, bank, task_id)
);

create or replace function public.set_practice_draft_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists practice_drafts_set_updated_at on public.practice_drafts;
create trigger practice_drafts_set_updated_at
  before update on public.practice_drafts
  for each row execute function public.set_practice_draft_updated_at();

alter table public.practice_drafts enable row level security;

drop policy if exists "Users can read their own practice drafts" on public.practice_drafts;
drop policy if exists "Users can create their own practice drafts" on public.practice_drafts;
drop policy if exists "Users can update their own practice drafts" on public.practice_drafts;
drop policy if exists "Users can delete their own practice drafts" on public.practice_drafts;

create policy "Users can read their own practice drafts"
  on public.practice_drafts for select
  using (auth.uid() = user_id);

create policy "Users can create their own practice drafts"
  on public.practice_drafts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own practice drafts"
  on public.practice_drafts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own practice drafts"
  on public.practice_drafts for delete
  using (auth.uid() = user_id);
