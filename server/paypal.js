const base = () => process.env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
export function paypalReady() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET &&
    process.env.PAYPAL_PLAN_ID && process.env.PAYPAL_WEBHOOK_ID &&
    process.env.PAYPAL_MONTHLY_PRICE && process.env.APP_URL);
}
async function accessToken() {
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST", headers: {Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded"},
    body: "grant_type=client_credentials"
  });
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status}).`);
  return (await response.json()).access_token;
}
export async function paypalRequest(path, {method="GET",body,requestId}={}) {
  const response = await fetch(`${base()}${path}`, {
    method, headers: {Authorization: `Bearer ${await accessToken()}`, Accept:"application/json",
      ...(body ? {"Content-Type":"application/json"} : {}),
      ...(requestId ? {"PayPal-Request-Id":requestId} : {})},
    ...(body ? {body:JSON.stringify(body)} : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`PayPal request failed (${response.status}): ${result.name || "contact support"}.`);
  return result;
}
export async function verifyPaypalWebhook(headers,event) {
  const names = ["paypal-auth-algo","paypal-cert-url","paypal-transmission-id","paypal-transmission-sig","paypal-transmission-time"];
  if (names.some(name=>!headers[name]) || !process.env.PAYPAL_WEBHOOK_ID) return false;
  const verified = await paypalRequest("/v1/notifications/verify-webhook-signature", {method:"POST",body:{
    auth_algo:headers["paypal-auth-algo"],cert_url:headers["paypal-cert-url"],
    transmission_id:headers["paypal-transmission-id"],transmission_sig:headers["paypal-transmission-sig"],
    transmission_time:headers["paypal-transmission-time"],webhook_id:process.env.PAYPAL_WEBHOOK_ID,
    webhook_event:event
  }});
  return verified.verification_status === "SUCCESS";
}

export async function verifyPaypalPlan(){
  const plan=await paypalRequest(`/v1/billing/plans/${encodeURIComponent(process.env.PAYPAL_PLAN_ID)}`);
  const regular=plan.billing_cycles?.find(cycle=>cycle.tenure_type==="REGULAR");
  if(plan.status!=="ACTIVE"||regular?.frequency?.interval_unit!=="MONTH"||
    regular.frequency.interval_count!==1||regular.total_cycles!==0||
    regular.pricing_scheme?.fixed_price?.currency_code!=="USD"||
    regular.pricing_scheme.fixed_price.value!==process.env.PAYPAL_MONTHLY_PRICE)
    throw new Error("PayPal plan must be active and match the configured monthly USD price.");
  return plan;
}
