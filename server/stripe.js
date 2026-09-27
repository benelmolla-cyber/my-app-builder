import Stripe from "stripe";
import {STRIPE_API_VERSION} from "./stripe-shapes.js";
export function stripeClient(){if(!process.env.STRIPE_SECRET_KEY)throw new Error("Stripe is not configured.");return new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:STRIPE_API_VERSION});}
