const path = require("path");
const { spawnSync } = require("child_process");

// Load repo root .env (same file http-backend uses: apps/* -> ../../.env)
require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env"),
  override: true,
});

const prismaBin = require.resolve("prisma/build/index.js");
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [prismaBin, ...args], {
  stdio: "inherit",
  cwd: path.resolve(__dirname, ".."),
  env: process.env,
});

process.exit(result.status ?? 1);
