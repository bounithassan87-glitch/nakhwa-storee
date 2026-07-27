// ESLint flat config — single source of truth for the whole repository.
//
// Design notes (deliberate architectural choices):
//
// 1. ONE root config, three scoped blocks (admin SPA / Pages Functions / Node
//    scripts) instead of a per-package config. The security-critical backend
//    (auth, CSRF, permissions, audit) is linted with the same gate as the UI,
//    and there is a single toolchain to install and upgrade.
//
// 2. Rules are selected for CORRECTNESS and SECURITY value, not style. Purely
//    cosmetic rules that would rewrite working code across 160+ files
//    (e.g. `import/order`) are intentionally excluded — churn without
//    reliability gain, and it conflicts with "never rewrite working code
//    unnecessarily".
//
// 3. Import resolution is NOT re-implemented here. `tsc --noEmit` already
//    validates every import path and type more accurately than an ESLint
//    resolver, so no resolver plugin (and no native postinstall binary) is
//    pulled into the supply chain.
//
// 4. Type-aware linting (`recommendedTypeChecked`) is deliberately deferred:
//    `functions/` currently has no tsconfig, so the rules could not be applied
//    uniformly. Tracked as the next hardening milestone.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/** Correctness rules applied to every TypeScript file in the repo. */
const sharedRules = {
  // Unused code is dead weight and often signals a real mistake. `_`-prefixed
  // arguments are an explicit "intentionally unused" marker.
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
  ],
  // `==` coerces; `===` does not. Prevents a whole class of subtle bugs.
  eqeqeq: ["error", "always", { null: "ignore" }],
  "no-var": "error",
  "prefer-const": "error",
  // Throwing non-Error values loses stack traces and breaks `instanceof Error`
  // checks, which this codebase relies on for error messages.
  "no-throw-literal": "error",
};

export default tseslint.config(
  // ── Never lint build output, dependencies, or generated artifacts ────────
  {
    ignores: [
      "**/node_modules/**",
      "dist/**", // built landing page + copied admin bundle
      "admin/dist/**", // admin build output
      ".wrangler/**",
      ".data/**",
      "prisma/migrations/**",
      "**/*.min.js",
    ],
  },

  // ── Admin SPA (React 19, browser) ───────────────────────────────────────
  {
    files: ["admin/src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...sharedRules,
      // Hooks correctness is non-negotiable: a violation is a runtime bug.
      "react-hooks/rules-of-hooks": "error",
      // Stale-closure bugs are the #1 source of "why is my data old?" defects.
      // Escape hatches must be justified inline (see the data hooks).
      "react-hooks/exhaustive-deps": "error",
      // Keeps Fast Refresh reliable during development.
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
      // The admin UI must never ship debug output to a customer-facing console.
      "no-console": "error",
    },
  },

  // ── Cloudflare Pages Functions (Workers runtime) ────────────────────────
  {
    files: ["functions/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      // Workers expose a service-worker-like global scope plus fetch/Web Crypto.
      globals: { ...globals.serviceworker, ...globals.browser },
    },
    rules: {
      ...sharedRules,
      // `console` here is intentional: functions/_lib/http.ts `log()` writes
      // structured JSON lines that Cloudflare Logs ingests.
      "no-console": "off",
    },
  },

  // ── Node tooling scripts ────────────────────────────────────────────────
  {
    files: ["scripts/**/*.mjs", "prisma/**/*.mjs", "*.config.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...sharedRules,
      "@typescript-eslint/no-unused-vars": "off", // TS rule not applicable to plain JS
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      // CLI scripts communicate with the operator through stdout by design.
      "no-console": "off",
    },
  },

  // ── Vite config runs in Node, not the browser ───────────────────────────
  {
    files: ["admin/vite.config.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: sharedRules,
  },
);
