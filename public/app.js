const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const state = { type: "image", ratio: "1:1", session: null, signup: false, client: null, requestKey: null, objectUrls: [] };
const toast = (message, bad=false) => { const el=$("#toast"); el.textContent=message; el.className=`toast show ${bad?'bad':''}`; clearTimeout(state.toast); state.toast=setTimeout(()=>el.className="toast",3200); };

async function api(path, options={}) {
  const headers = { ...(options.body ? {"Content-Type":"application/json"} : {}), ...(options.headers||{}) };
  if (state.session) headers.Authorization=`Bearer ${state.session.access_token}`;
  const response=await fetch(`/api/${path}`,{...options,headers}); const data=await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error||"Request failed."); return data;
}
function openAuth(){ $("#authModal").classList.remove("hidden"); $("#email").focus(); }
function closeAuth(){ $("#authModal").classList.add("hidden"); }
function setSignup(value){ state.signup=value; $("#authTitle").textContent=value?"Start creating":"Welcome back"; $("#authSub").textContent=value?"Your 7-day trial includes 12 credits.":"Sign in to your private creative studio."; $("#authToggle").innerHTML=value?'Already have an account? <b>Log in</b>':'New to Sparky? <b>Create an account</b>'; }
async function refreshAccount(){
  if (!state.session){ $("#creditPill").classList.add("hidden"); $("#upgradeButton").classList.add("hidden"); $("#authButton").textContent="Log in"; return; }
  try { const data=await api("me"); $("#creditPill").classList.remove("hidden"); $("#upgradeButton").classList.toggle("hidden",data.owner); $("#upgradeButton").textContent=data.hasSubscription?"Manage plan":"Upgrade"; $("#upgradeButton").dataset.action=data.hasSubscription?"portal":"checkout"; $("#creditPill").textContent=data.owner?"∞ Owner":`${data.credits} credits`; $("#authButton").textContent="Log out"; }
  catch(error){ toast(error.message,true); }
}
async function showView(name){
  $("#createView").classList.toggle("hidden",name!=="create"); $("#libraryView").classList.toggle("hidden",name!=="library");
  $$(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.view===name));
  if(name==="library") await loadLibrary();
}
async function loadLibrary(){
  if(!state.session){ openAuth(); showView("create"); return; } const grid=$("#libraryGrid"); grid.innerHTML='<div class="loading">Loading your creations…</div>';
  try { const {items}=await api("library"); grid.innerHTML=""; $("#libraryEmpty").classList.toggle("hidden",items.length>0); for(const item of items){ const card=document.createElement("article"); card.className="media-card"; const media=item.kind==="video"?document.createElement("video"):document.createElement("img"); media.src=await authenticatedMedia(item.download_url); if(item.kind==="video"){media.controls=true;media.playsInline=true;} else media.alt=item.prompt; const cap=document.createElement("div"); cap.innerHTML=`<span>${item.kind}</span><p></p><a download>Download</a>`; cap.querySelector("p").textContent=item.prompt; cap.querySelector("a").href=media.src; card.append(media,cap); grid.append(card); } }
  catch(error){ grid.innerHTML=""; toast(error.message,true); }
}
async function generate(){
  if(!state.session) return openAuth(); const prompt=$("#prompt").value.trim(); if(!prompt)return toast("Describe what you want to create.",true);
  const btn=$("#generate"); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Creating…'; const box=$("#result"); box.className="result working"; box.innerHTML=`<div class="result-status"><span class="orb">✦</span><h3>Bringing your idea to life</h3><p>${state.type==='video'?'Videos can take several minutes. Keep this tab open.':'This usually takes less than a minute.'}</p></div>`;
  try { state.requestKey=state.requestKey||crypto.randomUUID(); const {generation}=await api("generate",{method:"POST",headers:{"Idempotency-Key":state.requestKey},body:JSON.stringify({type:state.type,prompt,aspectRatio:state.ratio})}); const finished=await waitForGeneration(generation.id); if(finished.status!=="succeeded"){state.requestKey=null;throw new Error(finished.error||"Generation failed. Your credits were refunded.");} const source=await authenticatedMedia(finished.downloadUrl); const media=state.type==="video"?`<video src="${source}" controls autoplay muted playsinline></video>`:`<img src="${source}" alt="Generated artwork">`; box.className="result"; box.innerHTML=`${media}<div class="result-meta"><div><span>JUST CREATED</span><p></p></div><a class="button secondary" href="${source}" download>Download</a></div>`; box.querySelector(".result-meta p").textContent=prompt; state.requestKey=null; await refreshAccount(); }
  catch(error){ box.className="result hidden"; toast(error.message,true); await refreshAccount(); }
  finally { btn.disabled=false; btn.innerHTML=`<span>${state.type==='video'?'▶':'✦'}</span> Generate ${state.type}`; }
}
async function waitForGeneration(id){ for(let i=0;i<180;i++){const {generation}=await api(`generate?id=${encodeURIComponent(id)}`);if(["succeeded","failed"].includes(generation.status))return generation;await new Promise(resolve=>setTimeout(resolve,2000));}throw new Error("Generation is still processing. It will remain in your library when complete."); }
async function authenticatedMedia(path){const response=await fetch(path,{headers:{Authorization:`Bearer ${state.session.access_token}`}});if(!response.ok)throw new Error("Could not download private media.");const url=URL.createObjectURL(await response.blob());state.objectUrls.push(url);return url;}
async function init(){
  try { const config=await api("config"); if(!config.supabaseUrl||!config.supabaseAnonKey) throw new Error("Sparky is not configured yet."); state.client=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey); const {data}=await state.client.auth.getSession(); state.session=data.session; state.client.auth.onAuthStateChange((_event,session)=>{state.session=session;refreshAccount();}); await refreshAccount(); if(new URLSearchParams(location.search).get("checkout")==="success")toast("Subscription active — credits arrive after payment confirmation."); }
  catch(error){ toast(error.message,true); }
}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$$('.mode').forEach(b=>b.addEventListener('click',()=>{state.type=b.dataset.type;$$('.mode').forEach(x=>x.classList.toggle('active',x===b));$("#generate").innerHTML=`<span>${state.type==='video'?'▶':'✦'}</span> Generate ${state.type}`;}));
$$('.ratio').forEach(b=>b.addEventListener('click',()=>{state.ratio=b.dataset.ratio;$$('.ratio').forEach(x=>x.classList.toggle('active',x===b));}));
$$('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{$("#prompt").value=b.dataset.prompt;$("#prompt").focus();}));
$("#generate").addEventListener("click",generate); $(".close").addEventListener("click",closeAuth); $("#authModal").addEventListener("click",e=>{if(e.target.id==="authModal")closeAuth();}); $("#authToggle").addEventListener("click",()=>setSignup(!state.signup));
$("#upgradeButton").addEventListener("click",async e=>{ try { const endpoint=e.currentTarget.dataset.action==="portal"?"create-portal":"create-checkout"; const {url}=await api(endpoint,{method:"POST",body:"{}"}); location.href=url; } catch(error){ toast(error.message,true); } });
$("#authButton").addEventListener("click",async()=>{if(!state.session)return openAuth();await state.client.auth.signOut();toast("Signed out.");});
$("#authForm").addEventListener("submit",async e=>{e.preventDefault(); if(!state.client)return toast("Authentication is not configured.",true); const credentials={email:$("#email").value,password:$("#password").value}; const {data,error}=state.signup?await state.client.auth.signUp(credentials):await state.client.auth.signInWithPassword(credentials); if(error)return toast(error.message,true); closeAuth(); if(state.signup&&!data.session)toast("Check your email to confirm your account."); else toast("Welcome to Sparky.");});
init();
