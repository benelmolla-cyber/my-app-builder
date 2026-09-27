import {recoverJobs} from "../server/jobs.js";
export const config={maxDuration:300};
export default async function handler(req,res){if(req.method!=="GET")return res.status(405).end(); if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:"Unauthorized."}); try{res.status(200).json(await recoverJobs());}catch(error){console.error(error);res.status(500).json({error:"Job recovery failed."});}}
