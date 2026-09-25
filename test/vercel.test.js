import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const config=JSON.parse(await readFile(new URL("../vercel.json",import.meta.url)));
test("Vercel routes static entry points without shadowing API functions",()=>{assert.deepEqual(config.rewrites.map(x=>x.source),["/","/app.js","/styles.css"]);assert.ok(config.crons.some(x=>x.path==="/api/jobs"));});
