-- Tally — budget tracker schema. ADDITIVE to the shared (Tandem) Supabase project.
-- Run in Dashboard → SQL Editor. Safe to re-run (drop-and-recreate policies only —
-- no DROP TABLE / DELETE / TRUNCATE anywhere; existing rows are never touched).
-- Relies on project-level public.profiles (owned by tandem/supabase/schema.sql)
-- and on sign-ups being disabled, so "authenticated" = one of the two of us.

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists public.budget_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  colour      text not null default '#2fbf71',
  icon        text not null default '🧾',
  sort_order  integer not null default 0,
  is_archived boolean not null default false
);

create table if not exists public.budget_rules (
  id           uuid primary key default gen_random_uuid(),
  pattern      text not null unique,
  category_id  uuid not null references public.budget_categories (id) on delete cascade,
  hits         integer not null default 0,
  created_from text not null default 'correction' check (created_from in ('seed', 'correction'))
);

create table if not exists public.budget_imports (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  account         text not null,
  filename        text not null,
  imported_at     timestamptz not null default now(),
  row_count       integer not null default 0,
  new_count       integer not null default 0,
  duplicate_count integer not null default 0
);

create table if not exists public.budget_transactions (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles (id) on delete cascade,
  account            text not null,
  txn_date           date not null,
  amount             numeric(12,2) not null,
  description        text not null,
  merchant_norm      text not null default '',
  category_id        uuid references public.budget_categories (id) on delete set null,
  category_confirmed boolean not null default false,
  import_hash        text not null unique,
  source             text not null default 'csv' check (source in ('csv', 'manual')),
  import_id          uuid references public.budget_imports (id) on delete set null
);

create index if not exists budget_txn_date_idx     on public.budget_transactions (txn_date);
create index if not exists budget_txn_merchant_idx on public.budget_transactions (merchant_norm);

create table if not exists public.budget_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  merchant_norm text not null,
  name          text not null,
  cadence       text not null check (cadence in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annual')),
  amount        numeric(12,2) not null,
  price_history jsonb not null default '[]',
  next_expected date,
  status        text not null default 'candidate' check (status in ('candidate', 'confirmed', 'dismissed', 'cancelled')),
  unique (owner_id, merchant_norm)
);

-- One row per real-world bank account (each person keeps several). Balances are
-- captured automatically from CSV running-balance columns at import time, or
-- entered by hand for accounts that never see an import.
create table if not exists public.budget_accounts (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  owner_id       uuid references public.profiles (id) on delete set null,
  balance        numeric(12,2),
  balance_as_of  date,
  sort_order     integer not null default 0,
  is_archived    boolean not null default false
);

create table if not exists public.budget_bills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  amount      numeric(12,2) not null,
  is_estimate boolean not null default false,
  frequency   text not null check (frequency in ('monthly', 'quarterly', 'annual')),
  due_day     integer not null check (due_day between 1 and 31),
  next_due    date not null,
  autopay     boolean not null default false,
  category_id uuid references public.budget_categories (id) on delete set null,
  last_paid   date
);

-- ── v3 additive changes ───────────────────────────────────────────────────────
alter table public.budget_transactions add column if not exists note text not null default '';
alter table public.budget_accounts     add column if not exists goal_amount numeric(12,2);
alter table public.budget_categories   add column if not exists exclude_from_analytics boolean not null default false;

-- Per-category monthly budgets (household-wide; set once, tracked automatically).
create table if not exists public.budget_budgets (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null unique references public.budget_categories (id) on delete cascade,
  monthly_limit numeric(12,2) not null
);

-- ── Seeds (idempotent via unique names/patterns) ─────────────────────────────

insert into public.budget_categories (name, colour, icon, sort_order) values
  ('Groceries',     '#2fbf71', '🛒', 1),
  ('Eating Out',    '#f4a259', '🍽️', 2),
  ('Transport',     '#5b8def', '🚌', 3),
  ('Fuel',          '#8d6a9f', '⛽', 4),
  ('Utilities',     '#4ecdc4', '💡', 5),
  ('Rent/Mortgage', '#e07a5f', '🏠', 6),
  ('Insurance',     '#7f96ab', '🛡️', 7),
  ('Health',        '#e6739f', '🩺', 8),
  ('Entertainment', '#c05dd1', '🎬', 9),
  ('Subscriptions', '#f25f5c', '🔁', 10),
  ('Shopping',      '#ffb400', '🛍️', 11),
  ('Personal',      '#70a37f', '💇', 12),
  ('Gifts',         '#ef8fb0', '🎁', 13),
  ('Travel',        '#3aa7d9', '✈️', 14),
  ('Income',        '#1e9a58', '💰', 15),
  ('Other',         '#9aa5b1', '📦', 16)
on conflict (name) do nothing;

-- Transfers between our own accounts must not count as spend/income.
insert into public.budget_categories (name, colour, icon, sort_order, exclude_from_analytics)
values ('Transfers', '#7f96ab', '↔️', 17, true)
on conflict (name) do nothing;
update public.budget_categories set exclude_from_analytics = true where name = 'Transfers';

insert into public.budget_rules (pattern, category_id, created_from)
select v.pattern, c.id, 'seed'
from (values
  ('woolworths', 'Groceries'), ('coles', 'Groceries'), ('aldi', 'Groceries'), ('iga', 'Groceries'),
  ('mcdonald', 'Eating Out'), ('kfc', 'Eating Out'), ('hungry jack', 'Eating Out'),
  ('uber eats', 'Eating Out'), ('doordash', 'Eating Out'), ('menulog', 'Eating Out'),
  -- patterns must match the app's normaliser output: digits stripped ("7-ELEVEN"
  -- → "eleven"), "com" dropped ("APPLE.COM/BILL" → "apple bill").
  ('bp ', 'Fuel'), ('shell', 'Fuel'), ('ampol', 'Fuel'), ('caltex', 'Fuel'), ('eleven', 'Fuel'),
  ('uber', 'Transport'), ('opal', 'Transport'), ('myki', 'Transport'), ('translink', 'Transport'), ('linkt', 'Transport'),
  ('netflix', 'Subscriptions'), ('spotify', 'Subscriptions'), ('disney', 'Subscriptions'),
  ('binge', 'Subscriptions'), ('stan', 'Subscriptions'), ('prime video', 'Subscriptions'),
  ('youtube premium', 'Subscriptions'), ('apple bill', 'Subscriptions'),
  ('agl', 'Utilities'), ('origin energy', 'Utilities'), ('energyaustralia', 'Utilities'),
  ('telstra', 'Utilities'), ('optus', 'Utilities'), ('vodafone', 'Utilities'), ('aussie broadband', 'Utilities'),
  ('medibank', 'Insurance'), ('bupa', 'Insurance'), ('hcf', 'Insurance'), ('nib', 'Insurance'),
  ('chemist warehouse', 'Health'), ('priceline', 'Health'),
  ('kmart', 'Shopping'), ('big w', 'Shopping'), ('target', 'Shopping'),
  ('bunnings', 'Shopping'), ('jb hi fi', 'Shopping'), ('amazon', 'Shopping'),
  ('salary', 'Income'), ('payroll', 'Income')
) as v(pattern, category)
join public.budget_categories c on c.name = v.category
on conflict (pattern) do nothing;

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- Read: any authenticated user (i.e. either of us) sees everything.
-- Writes: per-person rows (transactions, imports) are owner-only, matching
-- Tandem; jointly-owned rows (categories, rules, subscriptions, bills) are
-- writable by any authenticated user.

alter table public.budget_accounts      enable row level security;
alter table public.budget_categories    enable row level security;
alter table public.budget_rules         enable row level security;
alter table public.budget_imports       enable row level security;
alter table public.budget_transactions  enable row level security;
alter table public.budget_subscriptions enable row level security;
alter table public.budget_bills         enable row level security;
alter table public.budget_budgets       enable row level security;

-- shared-write tables ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['budget_categories', 'budget_rules', 'budget_subscriptions', 'budget_bills', 'budget_accounts', 'budget_budgets'] loop
    execute format('drop policy if exists "%s: read all (authenticated)" on public.%I', t, t);
    execute format('create policy "%s: read all (authenticated)" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s: write all (authenticated)" on public.%I', t, t);
    execute format('create policy "%s: write all (authenticated)" on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- owner-write tables ----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['budget_imports', 'budget_transactions'] loop
    execute format('drop policy if exists "%s: read all (authenticated)" on public.%I', t, t);
    execute format('create policy "%s: read all (authenticated)" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s: insert own" on public.%I', t, t);
    execute format('create policy "%s: insert own" on public.%I for insert to authenticated with check (owner_id = auth.uid())', t, t);
    execute format('drop policy if exists "%s: update own" on public.%I', t, t);
    execute format('create policy "%s: update own" on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
    execute format('drop policy if exists "%s: delete own" on public.%I', t, t);
    execute format('create policy "%s: delete own" on public.%I for delete to authenticated using (owner_id = auth.uid())', t, t);
  end loop;
end $$;

-- Exception: category corrections must work on the PARTNER's transactions too
-- (either person can tidy the books). Permissive policies OR together, so this
-- effectively makes transaction UPDATES shared — acceptable in a two-person
-- project; the owner-only insert/delete policies still stop one person creating
-- or removing the other's transactions.
drop policy if exists "budget_transactions: categorise any" on public.budget_transactions;
create policy "budget_transactions: categorise any"
  on public.budget_transactions for update
  to authenticated
  using (true)
  with check (true);

-- ── Realtime ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['budget_transactions', 'budget_bills', 'budget_subscriptions', 'budget_accounts', 'budget_budgets'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
