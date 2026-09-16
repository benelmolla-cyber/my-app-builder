"use strict";

(() => {
  const config = window.BUILDPRO_CONFIG || {};

  const state = {
    code: "",
    projectName: "Untitled project",
    generating: false,
    credits: getSavedCredits()
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const el = {
    form: $("#promptForm"),
    prompt: $("#prompt"),
    generateButton: $("#generateButton"),
    generateText: $("#generateText"),
    loadingDots: $("#loadingDots"),
    chat: $("#chat"),
    examples: $("#examples"),
    preview: $("#preview"),
    emptyPreview: $("#emptyPreview"),
    status: $("#status"),
    projectName: $("#projectName"),
    previewAddress: $("#previewAddress"),
    creditDisplay: $("#creditDisplay"),
    charCount: $("#charCount"),
    codeModal: $("#codeModal"),
    codeOutput: $("#codeOutput"),
    publishModal: $("#publishModal"),
    pricingModal: $("#pricingModal")
  };

  function getSavedCredits() {
    const defaultCredits = config.trial?.freeBuilds || 10;
    const stored = Number(localStorage.getItem("buildpro_credits"));

    if (!Number.isFinite(stored) || stored < 0) {
      return defaultCredits;
    }

    return stored;
  }

  function saveCredits() {
    localStorage.setItem("buildpro_credits", String(state.credits));
    el.creditDisplay.textContent = state.credits;
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  function setGenerating(value) {
    state.generating = value;
    el.generateButton.disabled = value;

    el.generateText.classList.toggle("hidden", value);
    el.loadingDots.classList.toggle("hidden", !value);

    el.status.textContent = value
      ? "Generating project..."
      : "Ready";
  }

  function addMessage(role, message) {
    const wrapper = document.createElement("div");

    if (role === "user") {
      wrapper.innerHTML = `
        <div class="flex justify-end">
          <div class="max-w-[88%] px-4 py-3 rounded-2xl rounded-br-md bg-violet-600/15 border border-violet-500/20">
            <p class="m-0 text-sm text-zinc-200 leading-6">
              ${escapeHTML(message)}
            </p>
          </div>
        </div>
      `;
    } else {
      wrapper.innerHTML = `
        <div class="flex gap-3">
          <div class="w-8 h-8 shrink-0 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-xs text-violet-400">
            AI
          </div>

          <div>
            <div class="text-xs text-zinc-500 mb-1">BuildPro AI</div>
            <p class="m-0 text-sm text-zinc-300 leading-6">
              ${escapeHTML(message)}
            </p>
          </div>
        </div>
      `;
    }

    el.chat.appendChild(wrapper);
    el.chat.scrollTop = el.chat.scrollHeight;
  }

  function extractName(prompt, fallback) {
    const expressions = [
      /called\s+["“]?([^"”.,]+)["”]?/i,
      /named\s+["“]?([^"”.,]+)["”]?/i
    ];

    for (const expression of expressions) {
      const match = prompt.match(expression);

      if (match?.[1]) {
        return match[1].trim().slice(0, 60);
      }
    }

    return fallback;
  }

  function analyzePrompt(prompt) {
    const text = prompt.toLowerCase();

    if (/coffee|cafe|café|restaurant|bakery|food/.test(text)) {
      return {
        type: "coffee",
        name: extractName(prompt, "Ember & Bean")
      };
    }

    if (/saas|software|startup|analytics|artificial intelligence|ai app|dashboard/.test(text)) {
      return {
        type: "saas",
        name: extractName(prompt, "Vectorly")
      };
    }

    if (/portfolio|designer|developer|creative|photographer/.test(text)) {
      return {
        type: "portfolio",
        name: extractName(prompt, "Alex Morgan")
      };
    }

    if (/store|shop|ecommerce|e-commerce|product/.test(text)) {
      return {
        type: "store",
        name: extractName(prompt, "Nova Store")
      };
    }

    return {
      type: "generic",
      name: extractName(prompt, "Nova")
    };
  }

  function commonCSS(accent = "#7c3aed") {
    return `
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }

      body {
        margin: 0;
        background: #fafafa;
        color: #18181b;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      a { color: inherit; text-decoration: none; }
      button, input { font: inherit; }

      .container {
        width: min(1120px, calc(100% - 40px));
        margin: auto;
      }

      nav {
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .logo {
        font-weight: 900;
        letter-spacing: -.04em;
        font-size: 19px;
      }

      .links {
        display: flex;
        gap: 25px;
        color: #71717a;
        font-size: 14px;
      }

      .button {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        border: 0;
        border-radius: 12px;
        padding: 13px 19px;
        font-weight: 750;
        cursor: pointer;
        transition: .2s;
      }

      .button:hover {
        transform: translateY(-2px);
      }

      .primary {
        background: ${accent};
        color: white;
      }

      .secondary {
        background: white;
        border: 1px solid #e4e4e7;
      }

      .hero {
        padding: 120px 0 100px;
        text-align: center;
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: .17em;
        font-size: 11px;
        font-weight: 800;
        color: ${accent};
        margin-bottom: 20px;
      }

      h1 {
        max-width: 900px;
        margin: 0 auto 25px;
        font-size: clamp(46px, 8vw, 82px);
        line-height: .98;
        letter-spacing: -.065em;
      }

      h2 {
        font-size: clamp(32px, 5vw, 52px);
        letter-spacing: -.05em;
        line-height: 1.05;
      }

      h3 {
        font-size: 19px;
      }

      .lead {
        max-width: 650px;
        margin: 0 auto 32px;
        color: #71717a;
        font-size: 18px;
        line-height: 1.75;
      }

      .actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      section {
        padding: 90px 0;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
        margin-top: 40px;
      }

      .card {
        background: white;
        border: 1px solid #e4e4e7;
        border-radius: 22px;
        padding: 28px;
        box-shadow: 0 15px 50px rgba(0,0,0,.04);
      }

      .card p {
        color: #71717a;
        line-height: 1.7;
      }

      .dark {
        background: #18181b;
        color: white;
      }

      .dark p {
        color: #a1a1aa;
        max-width: 650px;
        line-height: 1.8;
      }

      footer {
        border-top: 1px solid #e4e4e7;
        padding: 30px 0;
        color: #71717a;
        font-size: 13px;
      }

      @media (max-width: 760px) {
        .links { display: none; }
        .grid { grid-template-columns: 1fr; }
        section { padding: 65px 0; }
        .hero { padding: 90px 0 70px; }
      }
    `;
  }

  function pageDocument(title, content, accent) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)}</title>
<style>
${commonCSS(accent)}
</style>
</head>
<body>
${content}

<script>
document.querySelectorAll("[data-target]").forEach(function(button) {
  button.addEventListener("click", function() {
    var target = document.querySelector(button.dataset.target);

    if (target) {
      target.scrollIntoView({behavior:"smooth"});
    }
  });
});
<\/script>

</body>
</html>`;
  }

  function generateCoffee(data) {
    return pageDocument(
      data.name,
      `
<header>
  <div class="container">
    <nav>
      <div class="logo">${escapeHTML(data.name)}</div>

      <div class="links">
        <a href="#menu">Menu</a>
        <a href="#story">Story</a>
        <a href="#visit">Visit</a>
      </div>

      <button class="button primary" data-target="#visit">
        Visit us
      </button>
    </nav>
  </div>
</header>

<main>

<section class="hero">
  <div class="container">

    <div class="eyebrow">
      Specialty coffee · Crafted daily
    </div>

    <h1>
      Coffee worth slowing down for.
    </h1>

    <p class="lead">
      Exceptional beans, thoughtful roasting and a warm neighborhood space built around great coffee.
    </p>

    <div class="actions">
      <button class="button primary" data-target="#menu">
        Explore our menu
      </button>

      <button class="button secondary" data-target="#story">
        Our story
      </button>
    </div>

  </div>
</section>

<section id="menu">
  <div class="container">

    <div class="eyebrow">Favorites</div>
    <h2>Made beautifully.<br>Served simply.</h2>

    <div class="grid">

      <article class="card">
        <div style="font-size:35px">☕</div>
        <h3>House Espresso</h3>
        <p>Chocolate, caramel and toasted almond.</p>
        <strong>$4.50</strong>
      </article>

      <article class="card">
        <div style="font-size:35px">🥐</div>
        <h3>Butter Croissant</h3>
        <p>Freshly baked every morning.</p>
        <strong>$4.00</strong>
      </article>

      <article class="card">
        <div style="font-size:35px">🍵</div>
        <h3>Matcha Cloud</h3>
        <p>Ceremonial matcha and silky oat milk.</p>
        <strong>$6.50</strong>
      </article>

    </div>
  </div>
</section>

<section id="story" class="dark">
  <div class="container">
    <div class="eyebrow">Our story</div>

    <h2>
      Great coffee.<br>
      Better conversations.
    </h2>

    <p>
      We created ${escapeHTML(data.name)} as a place to pause,
      meet and enjoy coffee made with genuine attention to detail.
    </p>
  </div>
</section>

<section id="visit">
  <div class="container">
    <div class="card">

      <div class="eyebrow">Visit</div>

      <h2>Come say hello.</h2>

      <p>
        42 Market Street<br>
        Monday–Sunday · 7 AM–6 PM
      </p>

      <button class="button primary">
        Get directions
      </button>

    </div>
  </div>
</section>

</main>

<footer>
  <div class="container">
    © 2026 ${escapeHTML(data.name)}
  </div>
</footer>
`,
      "#b45309"
    );
  }

  function generateSaaS(data) {
    return pageDocument(
      data.name,
      `
<header>
<div class="container">
<nav>
<div class="logo">${escapeHTML(data.name)}</div>

<div class="links">
<a href="#features">Features</a>
<a href="#pricing">Pricing</a>
<a href="#about">Company</a>
</div>

<button class="button primary" data-target="#pricing">
Start free
</button>
</nav>
</div>
</header>

<main>

<section class="hero">
<div class="container">

<div class="eyebrow">
AI-powered workspace
</div>

<h1>
Turn complexity into clarity.
</h1>

<p class="lead">
Understand your business faster with intelligent analytics, beautiful dashboards and AI-powered insights.
</p>

<div class="actions">
<button class="button primary" data-target="#pricing">
Start building
</button>

<button class="button secondary" data-target="#features">
Explore features
</button>
</div>

</div>
</section>

<section id="features">
<div class="container">

<div class="eyebrow">Platform</div>
<h2>Everything your team<br>needs to move faster.</h2>

<div class="grid">

<div class="card">
<h3>✦ AI Insights</h3>
<p>Automatically discover trends, opportunities and anomalies in your data.</p>
</div>

<div class="card">
<h3>◈ Live Analytics</h3>
<p>Track the metrics that matter with beautiful real-time dashboards.</p>
</div>

<div class="card">
<h3>↗ Smart Reports</h3>
<p>Turn complex information into reports your entire organization understands.</p>
</div>

</div>
</div>
</section>

<section id="about" class="dark">
<div class="container">

<div class="eyebrow">Built for modern teams</div>

<h2>
One workspace.<br>
Every signal.
</h2>

<p>
${escapeHTML(data.name)} connects your most important information
and transforms it into actionable intelligence.
</p>

</div>
</section>

<section id="pricing">
<div class="container">

<div class="card" style="max-width:650px;margin:auto;text-align:center">

<div class="eyebrow">Simple pricing</div>

<h2>Pro</h2>

<div style="font-size:52px;font-weight:900;letter-spacing:-.06em">
$29
<span style="font-size:15px;color:#71717a">/month</span>
</div>

<p>
Unlimited analytics, dashboards and AI insights.
</p>

<button class="button primary" style="width:100%">
Start your free trial
</button>

</div>
</div>
</section>

</main>

<footer>
<div class="container">
© 2026 ${escapeHTML(data.name)}
</div>
</footer>
`,
      "#7c3aed"
    );
  }

  function generatePortfolio(data) {
    return pageDocument(
      data.name,
      `
<header>
<div class="container">
<nav>

<div class="logo">${escapeHTML(data.name)}</div>

<div class="links">
<a href="#work">Work</a>
<a href="#about">About</a>
<a href="#contact">Contact</a>
</div>

<button class="button primary" data-target="#contact">
Let's talk
</button>

</nav>
</div>
</header>

<main>

<section class="hero" style="text-align:left">
<div class="container">

<div class="eyebrow">
Product designer · Creative thinker
</div>

<h1 style="margin-left:0">
Designing digital experiences people love.
</h1>

<p class="lead" style="margin-left:0">
I design thoughtful digital products that turn complicated problems into simple, useful experiences.
</p>

<div class="actions" style="justify-content:flex-start">
<button class="button primary" data-target="#work">
View my work
</button>
</div>

</div>
</section>

<section id="work">
<div class="container">

<div class="eyebrow">Selected work</div>
<h2>Projects with purpose.</h2>

<div class="grid">

<div class="card">
<div style="height:150px;border-radius:14px;background:#18181b"></div>
<h3>Atlas Finance</h3>
<p>Making personal finance calmer and easier to understand.</p>
</div>

<div class="card">
<div style="height:150px;border-radius:14px;background:#d4d4d8"></div>
<h3>Northstar</h3>
<p>A collaborative workspace for modern product teams.</p>
</div>

<div class="card">
<div style="height:150px;border-radius:14px;background:#ddd6fe"></div>
<h3>Studio</h3>
<p>A new digital experience for an independent creative company.</p>
</div>

</div>
</div>
</section>

<section id="about" class="dark">
<div class="container">

<div class="eyebrow">About</div>

<h2>
Curiosity meets craft.
</h2>

<p>
I work across product strategy, UX and visual design to create products that feel clear, useful and memorable.
</p>

</div>
</section>

<section id="contact">
<div class="container">

<div class="card">

<div class="eyebrow">Contact</div>

<h2>
Have a project in mind?
</h2>

<p>
Let's create something great together.
</p>

<button class="button primary">
Start a conversation
</button>

</div>
</div>
</section>

</main>
`,
      "#2563eb"
    );
  }

  function generateStore(data) {
    return pageDocument(
      data.name,
      `
<header>
<div class="container">
<nav>

<div class="logo">${escapeHTML(data.name)}</div>

<div class="links">
<a href="#products">Shop</a>
<a href="#about">About</a>
<a href="#products">New arrivals</a>
</div>

<button class="button primary" data-target="#products">
Shop now
</button>

</nav>
</div>
</header>

<section class="hero">
<div class="container">

<div class="eyebrow">
New collection
</div>

<h1>
Designed for everyday life.
</h1>

<p class="lead">
Thoughtfully designed essentials made with quality materials and a timeless point of view.
</p>

<button class="button primary" data-target="#products">
Explore collection
</button>

</div>
</section>

<section id="products">
<div class="container">

<div class="eyebrow">Featured</div>
<h2>Our latest collection.</h2>

<div class="grid">

<div class="card">
<div style="height:190px;background:#e4e4e7;border-radius:15px"></div>
<h3>Essential One</h3>
<p>Simple, functional and beautifully made.</p>
<strong>$79</strong>
</div>

<div class="card">
<div style="height:190px;background:#d4d4d8;border-radius:15px"></div>
<h3>Essential Two</h3>
<p>A modern staple designed to last.</p>
<strong>$99</strong>
</div>

<div class="card">
<div style="height:190px;background:#f4f4f5;border-radius:15px"></div>
<h3>Essential Three</h3>
<p>Premium materials with effortless style.</p>
<strong>$129</strong>
</div>

</div>
</div>
</section>

<section id="about" class="dark">
<div class="container">
<div class="eyebrow">Our philosophy</div>
<h2>Buy better.<br>Keep longer.</h2>
<p>We believe great products should be useful, beautiful and built to stay with you.</p>
</div>
</section>
`,
      "#18181b"
    );
  }

  function generateGeneric(data, prompt) {
    return pageDocument(
      data.name,
      `
<header>
<div class="container">
<nav>

<div class="logo">${escapeHTML(data.name)}</div>

<div class="links">
<a href="#features">Features</a>
<a href="#about">About</a>
<a href="#contact">Contact</a>
</div>

<button class="button primary" data-target="#contact">
Get started
</button>

</nav>
</div>
</header>

<section class="hero">
<div class="container">

<div class="eyebrow">
Built with BuildPro AI
</div>

<h1>
Turn your idea into something remarkable.
</h1>

<p class="lead">
${escapeHTML(prompt.slice(0, 300))}
</p>

<div class="actions">
<button class="button primary" data-target="#features">
Explore
</button>

<button class="button secondary" data-target="#contact">
Get started
</button>
</div>

</div>
</section>

<section id="features">
<div class="container">

<div class="eyebrow">Features</div>
<h2>Designed for what comes next.</h2>

<div class="grid">

<div class="card">
<h3>Fast</h3>
<p>A streamlined experience focused on speed.</p>
</div>

<div class="card">
<h3>Flexible</h3>
<p>Designed to adapt to your users and business.</p>
</div>

<div class="card">
<h3>Beautiful</h3>
<p>A polished responsive experience across devices.</p>
</div>

</div>
</div>
</section>

<section id="about" class="dark">
<div class="container">

<div class="eyebrow">About</div>

<h2>
Built around your idea.
</h2>

<p>
BuildPro AI generated this responsive starting point from your description.
</p>

</div>
</section>

<section id="contact">
<div class="container">

<div class="card">
<div class="eyebrow">Get started</div>
<h2>Ready for the next step?</h2>
<button class="button primary">Continue</button>
</div>

</div>
</section>
`,
      "#7c3aed"
    );
  }

  function simulateGeneration(prompt) {
    const data = analyzePrompt(prompt);

    switch (data.type) {
      case "coffee":
        return generateCoffee(data);

      case "saas":
        return generateSaaS(data);

      case "portfolio":
        return generatePortfolio(data);

      case "store":
        return generateStore(data);

      default:
        return generateGeneric(data, prompt);
    }
  }

  async function requestGeneration(prompt) {
    if (config.simulatedAI !== false) {
      await new Promise(resolve => setTimeout(resolve, 700));
      return simulateGeneration(prompt);
    }

    const response = await fetch(config.api.generate, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Generation failed.");
    }

    if (!data.html) {
      throw new Error("The generation API returned no HTML.");
    }

    return data.html;
  }

  async function generate(prompt) {
    const cleanPrompt = String(prompt || "").trim();

    if (!cleanPrompt || state.generating) {
      return;
    }

    if (state.credits <= 0) {
      addMessage(
        "ai",
        "Your free builds are finished. Upgrade to BuildPro Pro for unlimited builds."
      );

      openModal(el.pricingModal);
      return;
    }

    addMessage("user", cleanPrompt);

    if (el.examples) {
      el.examples.remove();
      el.examples = null;
    }

    el.prompt.value = "";
    updateCharacterCount();

    setGenerating(true);

    try {
      const html = await requestGeneration(cleanPrompt);
      const project = analyzePrompt(cleanPrompt);

      state.code = html;
      state.projectName = project.name;

      el.preview.srcdoc = html;
      el.preview.classList.remove("hidden");
      el.emptyPreview.classList.add("hidden");

      el.projectName.textContent = project.name;

      const slug = project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      el.previewAddress.textContent =
        `${slug || "project"}.buildpro.preview`;

      state.credits = Math.max(0, state.credits - 1);
      saveCredits();

      el.status.textContent = "Generated successfully";

      addMessage(
        "ai",
        `Your ${project.type} project is ready. You can preview it, view the source code, or export it.`
      );

    } catch (error) {
      console.error("BuildPro generation error:", error);

      el.status.textContent = "Generation failed";

      addMessage(
        "ai",
        error.message || "Generation failed. Please try again."
      );

    } finally {
      setGenerating(false);
    }
  }

  function updateCharacterCount() {
    el.charCount.textContent =
      `${el.prompt.value.length} / 3000`;
  }

  async function copyCode() {
    if (!state.code) {
      addMessage("ai", "Generate a project before copying code.");
      return;
    }

    try {
      await navigator.clipboard.writeText(state.code);
      el.status.textContent = "Code copied";
    } catch {
      el.codeOutput.textContent = state.code;
      openModal(el.codeModal);
    }
  }

  function downloadProject() {
    if (!state.code) return;

    const blob = new Blob(
      [state.code],
      { type: "text/html;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;

    anchor.download =
      state.projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") +
      ".html";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function checkout() {
    const button = $("#checkoutButton");
    const original = button.textContent;

    button.disabled = true;
    button.textContent = "Opening checkout...";

    try {
      const response = await fetch(config.api.checkout, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Checkout could not be started.");
      }

      if (!data.url) {
        throw new Error("Checkout URL was not returned.");
      }

      window.location.href = data.url;

    } catch (error) {
      console.error(error);

      alert(
        "Stripe is not configured yet. Add your Stripe environment variables before enabling subscriptions."
      );

    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  el.form.addEventListener("submit", event => {
    event.preventDefault();
    generate(el.prompt.value);
  });

  el.prompt.addEventListener("input", updateCharacterCount);

  el.prompt.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      el.form.requestSubmit();
    }
  });

  $$(".example").forEach(button => {
    button.addEventListener("click", () => {
      el.prompt.value = button.dataset.prompt || "";
      updateCharacterCount();
      el.prompt.focus();
    });
  });

  $("#desktopButton").addEventListener("click", () => {
    el.preview.style.width = "100%";
  });

  $("#mobileButton").addEventListener("click", () => {
    el.preview.style.width = "390px";
  });

  $("#codeButton").addEventListener("click", () => {
    if (!state.code) {
      addMessage("ai", "Generate a project first.");
      return;
    }

    el.codeOutput.textContent = state.code;
    openModal(el.codeModal);
  });

  $("#publishButton").addEventListener("click", () => {
    if (!state.code) {
      addMessage("ai", "Generate a project before exporting it.");
      return;
    }

    openModal(el.publishModal);
  });

  $("#copyCodeButton").addEventListener("click", copyCode);
  $("#publishCopyButton").addEventListener("click", copyCode);
  $("#downloadButton").addEventListener("click", downloadProject);

  $("#deployButton").addEventListener("click", () => {
    alert(
      "Connect BuildPro AI to a deployment provider such as Vercel or Cloudflare Pages to enable one-click deployment."
    );
  });

  $("#upgradeButton").addEventListener("click", () => {
    openModal(el.pricingModal);
  });

  $("#checkoutButton").addEventListener("click", checkout);

  $("#newProjectButton").addEventListener("click", () => {
    state.code = "";
    state.projectName = "Untitled project";

    el.preview.srcdoc = "";
    el.preview.classList.add("hidden");
    el.emptyPreview.classList.remove("hidden");

    el.projectName.textContent = "Untitled project";
    el.previewAddress.textContent = "preview.buildpro.ai";
    el.status.textContent = "Ready";

    addMessage(
      "ai",
      "New project started. What would you like to build?"
    );
  });

  $$("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      closeModal(
        document.getElementById(button.dataset.close)
      );
    });
  });

  [el.codeModal, el.publishModal, el.pricingModal].forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeModal(el.codeModal);
      closeModal(el.publishModal);
      closeModal(el.pricingModal);
    }
  });

  saveCredits();
  updateCharacterCount();
})();
