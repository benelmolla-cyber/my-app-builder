import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const config=JSON.parse(await readFile(new URL("../vercel.json",import.meta.url)));
test("Vercel config uses supported fields and exact static routes",()=>{assert.equal("public" in config,false);assert.deepEqual(config.rewrites.map(x=>x.source),["/","/app.js","/styles.css"]);assert.deepEqual(config.rewrites.map(x=>x.destination),["/public/index.html","/public/app.js","/public/styles.css"]);});
test("recovery cron stays within Hobby plan's once-per-day allowance",()=>{assert.deepEqual(config.crons,[{path:"/api/jobs",schedule:"17 3 * * *"}]);});
