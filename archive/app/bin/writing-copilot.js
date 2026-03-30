#!/usr/bin/env node

const http = require("node:http");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const invocationCwd = process.cwd();
const host = process.env.WRITING_COPILOT_HOST || "127.0.0.1";
const port = process.env.WRITING_COPILOT_PORT || "3000";
const workspaceDir =
  process.env.WRITING_COPILOT_WORKSPACE_DIR ||
  path.join(invocationCwd, "data", "workspace");
const noOpen = process.env.WRITING_COPILOT_NO_OPEN === "1";
const nextBin = require.resolve("next/dist/bin/next", {
  paths: [packageRoot]
});

function withEnv(overrides = {}) {
  return {
    ...process.env,
    ...overrides
  };
}

function runNext(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, ...args], {
      cwd: packageRoot,
      env: withEnv({
        WRITING_COPILOT_WORKSPACE_DIR: workspaceDir
      }),
      stdio: "inherit"
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `next ${args.join(" ")} exited with ${signal ?? `code ${code}`}`
        )
      );
    });

    child.on("error", reject);
  });
}

function waitForServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function attempt() {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(attempt, 250);
      });
    }

    attempt();
  });
}

function openBrowser(url) {
  if (noOpen) {
    console.log(`writing-copilot ready at ${url}`);
    return;
  }

  let command;
  let args;

  if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    stdio: "ignore",
    detached: true
  });

  child.on("error", () => {
    console.log(`writing-copilot ready at ${url}`);
  });

  child.unref();
}

async function main() {
  const buildIdPath = path.join(packageRoot, ".next", "BUILD_ID");

  if (!fs.existsSync(buildIdPath)) {
    await runNext(["build"]);
  }

  const server = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", host, "--port", port],
    {
      cwd: packageRoot,
      env: withEnv({
        WRITING_COPILOT_WORKSPACE_DIR: workspaceDir
      }),
      stdio: "inherit"
    }
  );

  const url = `http://${host}:${port}`;
  let browserOpened = false;

  const closeServer = (signal) => {
    if (!server.killed) {
      server.kill(signal);
    }
  };

  process.on("SIGINT", () => closeServer("SIGINT"));
  process.on("SIGTERM", () => closeServer("SIGTERM"));

  server.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  server.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  await waitForServer(url);

  if (!browserOpened) {
    openBrowser(url);
    browserOpened = true;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
