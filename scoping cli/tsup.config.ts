import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  external: ["puppeteer", "fsevents"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  noExternal: [/^\.\./],
});
