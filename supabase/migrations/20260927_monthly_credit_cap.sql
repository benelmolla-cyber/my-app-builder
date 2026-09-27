-- Run once in the Supabase SQL Editor if the original Sparky schema is already installed.
-- A renewal starts at 100 credits; unused credits do not carry into the next month.
-- This also caps any pre-existing accumulated balances at 100 credits.
update public.profiles set credits=least(credits,100) where credits>100;

create or replace function public.fail_and_refund_generation(p_generation_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_cost integer; v_user uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select cost,user_id into v_cost,v_user from generations where id=p_generation_id and status in ('submitting','processing') for update;
  if not found then return false; end if;
  update generations set status='failed',error=left(p_reason,500),refunded_at=now(),updated_at=now() where id=p_generation_id;
  if v_cost>0 then update profiles set credits=least(100,credits+v_cost) where id=v_user; end if;
  return true;
end $$;

create or replace function public.apply_subscription_payment(p_user_id uuid,p_invoice_id text,p_customer_id text,p_subscription_id text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  insert into credit_events(id,user_id,amount,reason) values('invoice:'||p_invoice_id,p_user_id,100,'stripe_invoice_paid') on conflict do nothing;
  if not found then return false; end if;
  update profiles set credits=100,stripe_customer_id=p_customer_id,stripe_subscription_id=p_subscription_id,stripe_subscription_status='active' where id=p_user_id;
  return true;
end $$;

revoke all on function public.fail_and_refund_generation(uuid,text) from public,anon,authenticated;
revoke all on function public.apply_subscription_payment(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.fail_and_refund_generation(uuid,text) to service_role;
grant execute on function public.apply_subscription_payment(uuid,text,text,text) to service_role;
