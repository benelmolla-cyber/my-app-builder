import test from "node:test";
import assert from "node:assert/strict";
import { runGeneration } from "../server/provider.js";

test("image generation sends the real provider request and returns its URL", async () => {
  process.env.REPLICATE_API_TOKEN="test-token"; let request;
  const url=await runGeneration({type:"image",prompt:"a comet",aspectRatio:"1:1"},{fetcher:async (...args)=>{request=args;return {ok:true,json:async()=>({status:"succeeded",output:["https://cdn.example/image.webp"]})};}});
  assert.equal(url,"https://cdn.example/image.webp"); assert.match(request[0],/flux-schnell/); assert.equal(JSON.parse(request[1].body).input.prompt,"a comet");
});

test("provider failures remain failures", async () => {
  process.env.REPLICATE_API_TOKEN="test-token";
  await assert.rejects(()=>runGeneration({type:"video",prompt:"storm",aspectRatio:"16:9"},{fetcher:async()=>({ok:false,json:async()=>({detail:"quota exceeded"})})}),/quota exceeded/);
});
