export const STRIPE_API_VERSION="2025-06-30.basil";
export function invoiceSubscriptionId(invoice){const value=invoice.parent?.subscription_details?.subscription??invoice.subscription;return typeof value==="string"?value:value?.id||null;}
