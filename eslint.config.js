import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Minimal quality baseline. Non-type-checked (fast) recommended rules.
// shadcn/ui generated components and build output are excluded to keep signal high.
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "client/src/components/ui/**",
      "**/*.config.{js,ts}",
      "server/public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // TypeScript already checks identifiers; avoid false positives on browser/node globals.
      "no-undef": "off",
      // Pragmatic for an imported prototype; tighten later.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-empty": "warn",
      "prefer-const": "warn",
      // Stylistic for this baseline; keep as a non-blocking warning for now.
      "preserve-caught-error": "warn",
    },
  },
);
