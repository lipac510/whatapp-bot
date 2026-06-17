create table if not exists sessions (
  customer_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists inquiries (
  id text primary key,
  customer_id text not null,
  profile_name text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists processed_messages (
  message_id text primary key,
  processed_at timestamptz not null default now()
);

create table if not exists failures (
  id text primary key,
  customer_id text not null default '',
  message_id text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists okki_syncs (
  id text primary key,
  customer_id text not null default '',
  message_id text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists message_events (
  id text primary key,
  customer_id text not null default '',
  message_id text not null default '',
  direction text not null default '',
  event_type text not null default '',
  category text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists known_customers (
  customer_id text primary key,
  reason text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists handoff_windows (
  customer_id text primary key,
  completed_at timestamptz not null default now(),
  reminder_sent boolean not null default false,
  reminder_sent_at timestamptz
);

create table if not exists emma_replies (
  customer_id text primary key,
  reason text not null default '',
  sent_at timestamptz not null default now()
);
