const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  html: "",
  busy: false,
  title: "Untitled Project"
};

const home = $("#home");
const builder = $("#builder");
const homePrompt = $("#homePrompt");
const builderPrompt = $("#builderPrompt");
const frame = $("#previewFrame");
const codeOutput = $("#codeOutput");
const emptyPreview = $("#emptyPreview");
const activity = $("#activity");
const stepsEl = $("#steps");
const agentStatus = $("#agentStatus");
const statusDot = $("#statusDot");

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => el.classList.remove("show"), 1800);
}

function showBuilder() {
  home.classList.add("hidden");
  builder.classList.remove("hidden");
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerHTML = `<div class="message-label">${role === "user" ? "YOU" : "BUILDPRO"}</div><p></p>`;
  div.querySelector("p").textContent = text;
  $("#conversation").appendChild(div);
  $("#conversation").scrollTop = $("#conversation").scrollHeight;
  return div;
}

const buildSteps = [
  "Understanding your request",
  "Planning the interface and interactions",
  "Writing application code",
  "Checking generated output",
  "Rendering live preview"
];

function beginActivity() {
  activity.classList.remove("hidden");
  stepsEl.innerHTML = buildSteps.map((s, i) => `<div class="step ${i === 0 ? "current" : ""}">${s}</div>`).join("");
  agentStatus.textContent = "Building";
  statusDot.style.background = "#a78bfa";
}

function setStep(index) {
  $$(".step").forEach((el, i) => {
    el.className = "step";
    if (i < index) el.classList.add("done");
    if (i === index) el.classList.add("current");
  });
}

function finishActivity(ok = true) {
  $$(".step").forEach(el => { el.className = "step done"; });
  setTimeout(() => activity.classList.add("hidden"), 700);
  agentStatus.textContent = ok ? "Ready" : "Error";
  statusDot.style.background = ok ? "#34d399" : "#fb7185";
}

function setBusy(value) {
  state.busy = value;
  $("#homeBuildBtn").disabled = value;
  $("#builderSend").disabled = value;
}

function render(html) {
  state.html = html;
  codeOutput.textContent = html;
  frame.srcdoc = html;
  emptyPreview.classList.add("hidden");
}

async function build(prompt) {
  if (state.busy || !prompt.trim()) return;
  showBuilder();
  addMessage("user", prompt.trim());
  builderPrompt.value = "";
  setBusy(true);
  beginActivity();

  let step = 0;
  const ticker = setInterval(() => {
    step = Math.min(step + 1, 3);
    setStep(step);
  }, 850);

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        currentHtml: state.html || null
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Build failed (${res.status})`);

    clearInterval(ticker);
    setStep(4);
    render(data.html);

    if (data.title) {
      state.title = data.title;
      $("#projectTitle").value = data.title;
    }

    addMessage("assistant", data.summary || "Build complete. The app is running in the preview. Tell me what you want to change next.");
    finishActivity(true);
  } catch (err) {
    clearInterval(ticker);
    finishActivity(false);
    addMessage("assistant", `I couldn't complete this build: ${err.message}`);
    toast("Build failed");
  } finally {
    setBusy(false);
  }
}

$("#homeForm").addEventListener("submit", e => {
  e.preventDefault();
  build(homePrompt.value);
});

$("#builderForm").addEventListener("submit", e => {
  e.preventDefault();
  build(builderPrompt.value);
});

[homePrompt, builderPrompt].forEach(el => {
  el.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      build(el.value);
    }
  });
});

$$("[data-prompt]").forEach(btn => {
  btn.addEventListener("click", () => {
    homePrompt.value = btn.dataset.prompt;
    homePrompt.focus();
  });
});

$("#openBuilderTop").addEventListener("click", showBuilder);
$("#backHome").addEventListener("click", () => {
  builder.classList.add("hidden");
  home.classList.remove("hidden");
});

$("#desktopBtn").addEventListener("click", () => {
  $("#previewShell").classList.remove("mobile");
  $("#desktopBtn").classList.add("active");
  $("#mobileBtn").classList.remove("active");
});

$("#mobileBtn").addEventListener("click", () => {
  $("#previewShell").classList.add("mobile");
  $("#mobileBtn").classList.add("active");
  $("#desktopBtn").classList.remove("active");
});

$("#refreshBtn").addEventListener("click", () => {
  if (state.html) frame.srcdoc = state.html;
});

$$(".tab").forEach(tab => tab.addEventListener("click", () => {
  $$(".tab").forEach(x => x.classList.remove("active"));
  tab.classList.add("active");
  const code = tab.dataset.view === "code";
  $("#previewView").classList.toggle("hidden", code);
  $("#codeView").classList.toggle("hidden", !code);
}));

$("#copyCodeBtn").addEventListener("click", async () => {
  if (!state.html) return toast("Nothing generated yet");
  await navigator.clipboard.writeText(state.html);
  toast("Code copied");
});

$("#downloadBtn").addEventListener("click", () => {
  if (!state.html) return toast("Generate an app first");
  const blob = new Blob([state.html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (state.title || "buildpro-app").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".html";
  a.click();
  URL.revokeObjectURL(url);
  toast("HTML exported");
});
