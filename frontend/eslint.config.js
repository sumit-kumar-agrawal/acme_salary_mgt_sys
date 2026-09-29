import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// FRONTEND_PLAN.md Q7: type-checked TypeScript rules, React hooks, accessibility; Prettier owns formatting.
export default defineConfig([
  globalIgnores(["dist", "coverage", "playwright-report", "test-results"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // React rules apply to the app only; e2e/ and config files are not React (Playwright's test.use is not a hook).
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    rules: {
      // Frontend security rules (FRONTEND_PLAN.md X3): API or user content is never rendered as HTML.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "Do not render HTML from strings (.claude/rules/frontend/security.md).",
        },
      ],
    },
  },
  {
    // Every E2E test runs with the privacy guard (FRONTEND_PLAN.md X2), so tests come from e2e/support.ts.
    files: ["e2e/**/*.ts"],
    ignores: ["e2e/support.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@playwright/test",
              importNames: ["test"],
              message:
                "Import test from ./support.ts so the privacy guard runs.",
            },
          ],
        },
      ],
    },
  },
  {
    // Fast refresh only matters for app code served by Vite; test support may mix helpers and components.
    files: ["src/test/**/*.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  prettier,
]);
