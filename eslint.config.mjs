import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Code quality rules
      "no-console": "warn", // Warn about console.log statements
      "no-debugger": "error", // Error on debugger statements
      "no-unused-vars": "off", // Turn off base rule as it conflicts with TypeScript
      "no-undef": "error", // Error on undefined variables
      "prefer-const": "error", // Prefer const over let when possible
      "no-var": "error", // Don't allow var declarations
      
      // React specific rules
      "react-hooks/rules-of-hooks": "error", // Enforce rules of hooks
      "react-hooks/exhaustive-deps": "warn", // Warn about missing dependencies
      "react/jsx-key": "error", // Require key prop in lists
      "react/jsx-no-duplicate-props": "error", // No duplicate props
      
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": "error", // TypeScript unused vars
      "@typescript-eslint/no-explicit-any": "warn", // Warn about any usage
      
      // Best practices
      "eqeqeq": "error", // Require === and !==
      "curly": "error", // Require curly braces
      "no-eval": "error", // No eval usage
      "no-implied-eval": "error", // No implied eval
      "no-new-func": "error", // No new Function()
    },
  },
];

export default eslintConfig;
