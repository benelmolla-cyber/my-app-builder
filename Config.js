"use strict";

window.BUILDPRO_CONFIG = {
  appName: "BuildPro AI",

  api: {
    generate: "/api/generate",
    checkout: "/api/checkout"
  },

  pricing: {
    proMonthly: 19
  },

  trial: {
    enabled: true,
    freeBuilds: 10
  },

  // Keep this true until your real AI API is configured.
  // When the backend AI is ready, change it to false.
  simulatedAI: true
};
