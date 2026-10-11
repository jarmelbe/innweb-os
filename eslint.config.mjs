import { globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**/*.cjs"]),
);
