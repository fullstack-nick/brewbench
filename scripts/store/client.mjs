import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";

const exec = promisify(execFile);
export const privateDir = resolve(".local/store");
export const store =
  process.env.SHOPIFY_STORE || "brewbench-practice.myshopify.com";
export const version = "2026-10";
const cli =
  process.env.SHOPIFY_CLI_ENTRY ||
  join(process.env.APPDATA || "", "npm/node_modules/@shopify/cli/bin/run.js");
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export async function json(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
}
export async function save(path, value) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}
export function userErrors(value, path = "") {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, val]) =>
    key === "userErrors" && Array.isArray(val)
      ? val.map((e) => ({ operation: path, ...e }))
      : userErrors(val, path ? `${path}.${key}` : key),
  );
}
export async function graphql(operation, variables = {}, options = {}) {
  await mkdir(privateDir, { recursive: true });
  const queryPath = resolve("scripts/store/operations", `${operation}.graphql`);
  const query = await readFile(queryPath, "utf8");
  const invocation = randomUUID();
  const variablePath = join(privateDir, `${invocation}.variables.json`);
  const outputPath = join(privateDir, `${invocation}.result.json`);
  await save(variablePath, variables);
  const args = [
    "store",
    "execute",
    "--store",
    store,
    "--version",
    version,
    "--query-file",
    queryPath,
    "--variable-file",
    variablePath,
    "--output-file",
    outputPath,
    "--json",
    "--no-input",
  ];
  if (/\bmutation\b/.test(query)) args.push("--allow-mutations");
  const env = { ...process.env };
  if (!(
    env.OPT_OUT_INSTRUMENTATION ||
    env.SHOPIFY_CLI_NO_ANALYTICS ||
    env.DO_NOT_TRACK
  )) {
    env.SHOPIFY_CLI_AGENT_INFO = "n:codex|v:none|p:openai|m:gpt-6";
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await exec(process.execPath, [cli, ...args], {
        env,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120000,
        windowsHide: true,
      });
      const result = await json(outputPath);
      if (result.errors?.length)
        throw Object.assign(new Error("GraphQL errors"), {
          details: result.errors,
        });
      const data = result.data || result;
      const errors = userErrors(data);
      if (errors.length && !options.allowUserErrors)
        throw Object.assign(new Error(`${operation}: mutation rejected`), {
          details: errors,
        });
      const throttle = result.extensions?.cost?.throttleStatus;
      if (throttle && throttle.currentlyAvailable < 100)
        await pause(
          Math.ceil(
            ((100 - throttle.currentlyAvailable) / throttle.restoreRate) * 1000,
          ),
        );
      return data;
    } catch (error) {
      await save(join(privateDir, `${invocation}.error.json`), {
        operation,
        message: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        details: error.details,
      });
      const transient = /THROTTLED|429|503|502|ECONNRESET|ETIMEDOUT/i.test(
        `${error.stdout || ""} ${error.stderr || ""} ${JSON.stringify(error.details || "")}`,
      );
      // Reads and explicitly idempotent operations alone may be retried after transport ambiguity.
      const retrySafe = !/\bmutation\b/.test(query) || options.idempotent;
      if (!transient || !retrySafe || attempt === 3)
        throw Object.assign(
          new Error(
            `${operation} failed; inspect private log ${invocation}.error.json`,
          ),
          { details: error.details },
        );
      await pause(Math.min(8000, 1000 * 2 ** attempt));
    }
  }
}
export async function paginate(operation, key, variables = {}) {
  const nodes = [];
  let after = null;
  do {
    const result = await graphql(operation, { ...variables, after });
    const connection = result[key];
    nodes.push(...connection.nodes);
    after = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (after);
  return nodes;
}
