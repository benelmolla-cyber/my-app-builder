-- Apply once to existing Sparky projects before enabling PayPal billing.
alter table public.profiles add column if not exists paypal_subscription_id text unique;
alter table public.profiles add column if not exists paypal_subscription_status text;

create or replace function public.reserve_generation(p_user_id uuid,p_idempotency_key uuid,p_kind text,p_prompt text,p_aspect_ratio text,p_cost integer,p_is_owner boolean)
returns table(generation_id uuid,created boolean,generation_status text) language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_credits integer; v_trial timestamptz; v_sub text; v_paypal text;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if (p_kind='image' and p_cost<>1) or (p_kind='video' and p_cost<>10) then raise exception 'invalid generation cost'; end if;
  if p_aspect_ratio not in ('1:1','16:9','9:16') then raise exception 'invalid aspect ratio'; end if;
  select id,status into v_id,generation_status from generations where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return query select v_id,false,generation_status; return; end if;
  select credits,trial_ends_at,stripe_subscription_status,paypal_subscription_status into v_credits,v_trial,v_sub,v_paypal from profiles where id=p_user_id for update;
  -- Check again after taking the per-user lock; concurrent requests now serialize.
  select id,status into v_id,generation_status from generations where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return query select v_id,false,generation_status; return; end if;
  if not p_is_owner then
    -- Free trials cover images; videos require a currently paid invoice.
    if p_kind='video' and (coalesce(v_sub,'') not in ('active','trialing') and coalesce(v_paypal,'') <> 'ACTIVE' or
      not exists (select 1 from credit_events where user_id=p_user_id and reason in ('stripe_invoice_paid','paypal_sale_paid')))
      then raise exception 'subscription required for video'; end if;
    if v_trial < now() and coalesce(v_sub,'') not in ('active','trialing') and coalesce(v_paypal,'') <> 'ACTIVE' then raise exception 'subscription required'; end if;
    if v_credits < p_cost then raise exception 'insufficient credits'; end if;
    update profiles set credits=credits-p_cost where id=p_user_id;
  end if;
  insert into generations(user_id,idempotency_key,kind,prompt,aspect_ratio,cost)
  values(p_user_id,p_idempotency_key,p_kind,p_prompt,p_aspect_ratio,case when p_is_owner then 0 else p_cost end) returning id,status into v_id,generation_status;
  return query select v_id,true,generation_status;
end $$;

create or replace function public.apply_paypal_payment(p_user_id uuid,p_sale_id text,p_subscription_id text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  perform 1 from profiles where id=p_user_id and paypal_subscription_id=p_subscription_id for update;
  if not found then raise exception 'PayPal subscription not linked to user'; end if;
  if exists(select 1 from credit_events where id='paypal-reversal:'||p_sale_id) then return false; end if;
  insert into credit_events(id,user_id,amount,reason) values('paypal-sale:'||p_sale_id,p_user_id,100,'paypal_sale_paid') on conflict do nothing;
  if not found then return false; end if;
  update profiles set credits=100,paypal_subscription_status='ACTIVE' where id=p_user_id;
  return true;
end $$;

create or replace function public.reverse_paypal_payment(p_user_id uuid,p_sale_id text,p_subscription_id text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  perform 1 from profiles where id=p_user_id and paypal_subscription_id=p_subscription_id for update;
  if not found then raise exception 'PayPal subscription not linked to user'; end if;
  insert into credit_events(id,user_id,amount,reason) values('paypal-reversal:'||p_sale_id,p_user_id,0,'paypal_sale_reversed') on conflict do nothing;
  if not found then return false; end if;
  update profiles set credits=0,paypal_subscription_status='SUSPENDED' where id=p_user_id;
  return true;
end $$;

revoke all on function public.apply_paypal_payment(uuid,text,text) from public,anon,authenticated;
revoke all on function public.reverse_paypal_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_generation(uuid,uuid,text,text,text,integer,boolean) to service_role;
grant execute on function public.fail_and_refund_generation(uuid,text) to service_role;
grant execute on function public.apply_subscription_payment(uuid,text,text,text) to service_role;
grant execute on function public.apply_paypal_payment(uuid,text,text) to service_role;
grant execute on function public.reverse_paypal_payment(uuid,text,text) to service_role;

