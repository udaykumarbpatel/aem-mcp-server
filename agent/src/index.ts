#!/usr/bin/env node
import process from "node:process";
import { run } from "./run.js";

async function main() {
  const goal = process.argv.slice(2).join(" ");
  if (!goal) {
    console.error("Usage: pnpm agent \"<goal>\"");
    process.exitCode = 1;
    return;
  }

  try {
    const state = await run(goal);
    console.log(JSON.stringify(state, null, 2));
  } catch (error) {
    console.error(`Agent execution failed: ${String(error)}`);
    process.exitCode = 1;
  }
}

void main();
