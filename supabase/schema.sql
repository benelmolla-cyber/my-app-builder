-- Run in a fresh Supabase project's SQL editor. Functions use row locks so credits
-- cannot be overspent by concurrent requests.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 12 check (credits >= 0),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_subscription_status text,
  created_at timestamptz not null default now()
);
create table public.generations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('image','video')), prompt text not null,
  cost integer not null check (cost in (0,1,10)), status text not null default 'processing' check (status in ('processing','succeeded','failed')),
  output_url text, error text, refunded_at timestamptz, created_at timestamptz not null default now()
);
create table public.credit_events (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null, reason text not null, created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.credit_events enable row level security;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "read own generations" on public.generations for select using (auth.uid() = user_id);

create or replace function public.new_user_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles(id) values(new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.new_user_profile();

create or replace function public.reserve_generation(p_user_id uuid, p_kind text, p_prompt text, p_cost integer, p_is_owner boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_credits integer; v_trial_ends_at timestamptz; v_subscription_status text;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if (p_kind = 'image' and p_cost <> 1) or (p_kind = 'video' and p_cost <> 10) then raise exception 'invalid generation cost'; end if;
  select credits,trial_ends_at,stripe_subscription_status into v_credits,v_trial_ends_at,v_subscription_status from profiles where id=p_user_id for update;
  if not found then raise exception 'profile not found'; end if;
  if not p_is_owner then
    if v_subscription_status is null and v_trial_ends_at < now() then raise exception 'trial expired'; end if;
    if v_credits < p_cost then raise exception 'insufficient credits'; end if;
    update profiles set credits=credits-p_cost where id=p_user_id;
  end if;
  insert into generations(user_id,kind,prompt,cost) values(p_user_id,p_kind,p_prompt,case when p_is_owner then 0 else p_cost end) returning id into v_id;
  return v_id;
end $$;

create or replace function public.fail_and_refund_generation(p_generation_id uuid, p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_cost integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select cost into v_cost from generations where id=p_generation_id and user_id=p_user_id and status='processing' for update;
  if found then
    update generations set status='failed', error=p_reason, refunded_at=now() where id=p_generation_id;
    if v_cost > 0 then update profiles set credits=credits+v_cost where id=p_user_id; end if;
  end if;
end $$;

create or replace function public.apply_subscription_payment(p_user_id uuid,p_event_id text,p_customer_id text,p_subscription_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  insert into credit_events(id,user_id,amount,reason) values(p_event_id,p_user_id,100,'stripe_invoice_paid') on conflict do nothing;
  if found then update profiles set credits=credits+100,stripe_customer_id=p_customer_id,stripe_subscription_id=p_subscription_id,stripe_subscription_status='active' where id=p_user_id; end if;
end $$;

revoke all on function public.reserve_generation(uuid,text,text,integer,boolean) from public, anon, authenticated;
revoke all on function public.fail_and_refund_generation(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.apply_subscription_payment(uuid,text,text,text) from public, anon, authenticated;
