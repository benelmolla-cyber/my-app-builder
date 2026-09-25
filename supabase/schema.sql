-- Sparky's initial schema. Apply to a fresh Supabase project.
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
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  kind text not null check (kind in ('image','video')),
  prompt text not null,
  aspect_ratio text not null check (aspect_ratio in ('1:1','16:9','9:16')),
  cost integer not null check (cost in (0,1,10)),
  status text not null default 'submitting' check (status in ('submitting','processing','succeeded','failed')),
  provider_prediction_id text unique,
  storage_path text,
  mime_type text,
  error text,
  attempt_count integer not null default 0,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);
create table public.credit_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index generations_recovery_idx on public.generations(status,updated_at) where status in ('submitting','processing');

alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.credit_events enable row level security;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "read own generations" on public.generations for select using (auth.uid() = user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('generated-media','generated-media',false,52428800,array['image/webp','image/png','image/jpeg','video/mp4','video/webm'])
on conflict(id) do update set public=false;
-- No storage.objects policy is intentional: media is accessed only through short-lived
-- signed URLs created by authenticated server endpoints using the service role.

create or replace function public.new_user_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id) values(new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.new_user_profile();

create or replace function public.reserve_generation(p_user_id uuid,p_idempotency_key uuid,p_kind text,p_prompt text,p_aspect_ratio text,p_cost integer,p_is_owner boolean)
returns table(generation_id uuid,created boolean,generation_status text) language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_credits integer; v_trial timestamptz; v_sub text;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if (p_kind='image' and p_cost<>1) or (p_kind='video' and p_cost<>10) then raise exception 'invalid generation cost'; end if;
  if p_aspect_ratio not in ('1:1','16:9','9:16') then raise exception 'invalid aspect ratio'; end if;
  select id,status into v_id,generation_status from generations where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return query select v_id,false,generation_status; return; end if;
  select credits,trial_ends_at,stripe_subscription_status into v_credits,v_trial,v_sub from profiles where id=p_user_id for update;
  -- Check again after taking the per-user lock; concurrent requests now serialize.
  select id,status into v_id,generation_status from generations where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return query select v_id,false,generation_status; return; end if;
  if not p_is_owner then
    if v_trial < now() and coalesce(v_sub,'') not in ('active','trialing') then raise exception 'subscription required'; end if;
    if v_credits < p_cost then raise exception 'insufficient credits'; end if;
    update profiles set credits=credits-p_cost where id=p_user_id;
  end if;
  insert into generations(user_id,idempotency_key,kind,prompt,aspect_ratio,cost)
  values(p_user_id,p_idempotency_key,p_kind,p_prompt,p_aspect_ratio,case when p_is_owner then 0 else p_cost end) returning id,status into v_id,generation_status;
  return query select v_id,true,generation_status;
end $$;

create or replace function public.fail_and_refund_generation(p_generation_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_cost integer; v_user uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select cost,user_id into v_cost,v_user from generations where id=p_generation_id and status in ('submitting','processing') for update;
  if not found then return false; end if;
  update generations set status='failed',error=left(p_reason,500),refunded_at=now(),updated_at=now() where id=p_generation_id;
  if v_cost>0 then update profiles set credits=credits+v_cost where id=v_user; end if;
  return true;
end $$;

create or replace function public.apply_subscription_payment(p_user_id uuid,p_invoice_id text,p_customer_id text,p_subscription_id text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  insert into credit_events(id,user_id,amount,reason) values('invoice:'||p_invoice_id,p_user_id,100,'stripe_invoice_paid') on conflict do nothing;
  if not found then return false; end if;
  update profiles set credits=credits+100,stripe_customer_id=p_customer_id,stripe_subscription_id=p_subscription_id,stripe_subscription_status='active' where id=p_user_id;
  return true;
end $$;

revoke all on function public.reserve_generation(uuid,uuid,text,text,text,integer,boolean) from public,anon,authenticated;
revoke all on function public.fail_and_refund_generation(uuid,text) from public,anon,authenticated;
revoke all on function public.apply_subscription_payment(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_generation(uuid,uuid,text,text,text,integer,boolean) to service_role;
grant execute on function public.fail_and_refund_generation(uuid,text) to service_role;
grant execute on function public.apply_subscription_payment(uuid,text,text,text) to service_role;
