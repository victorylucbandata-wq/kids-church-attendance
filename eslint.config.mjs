import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The secret-key client bypasses Row Level Security: keep it to the few server
  // modules allowed to use it (docs/multi-church-implementation-plan.md, 3.4).
  {
    files: ["app/**/*.{ts,tsx}", "proxy.ts"],
    ignores: [
      "app/api/kiosk/**",
      "app/api/cron/**",
      "app/api/network/**",
      "app/api/admin/church/**",
      "app/api/admin/team/**",
      "app/api/admin/service-times/**",
      "app/lib/church.ts",
      "app/lib/kiosk.ts",
      "app/lib/invite.ts",
      "app/lib/service-times.ts",
      "app/lib/network-overview.ts",
      "app/lib/supabase/admin.ts",
      "app/page.tsx",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "@/app/lib/supabase/admin", message: "Secret-key client: only allowed in the modules listed in eslint.config.mjs." }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
