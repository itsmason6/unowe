#!/usr/bin/env node
/**
 * Railway production build. Runs Vite directly so the deploy does not depend
 * on scripts/with-app-env.mjs being present in the GitHub upload.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
process.chdir(root);
process.env.NITRO_PRESET ||= "node-server";
process.env.VITE_AUTH_ENABLED ||= "false";

function run(file, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      stdio: "inherit",
      env: process.env,
      cwd: root,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} ${signal || `exit ${code}`}`));
    });
  });
}

const viteBin = join(root, "node_modules/vite/bin/vite.js");
if (!existsSync(viteBin)) {
  console.error("[railway-build] vite is not installed. Use npm install --include=dev first.");
  process.exit(1);
}

await run(viteBin, ["build"]);

const migrate = join(root, "scripts/migrate.mjs");
if (existsSync(migrate)) {
  await run(migrate);
}
