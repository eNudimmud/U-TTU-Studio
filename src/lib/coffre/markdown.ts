// A small frontmatter dialect: scalars and lists of strings. Strings are
// written as JSON strings, which YAML and Obsidian read as plain text.

export type FrontValue = string | number | boolean | null | string[];
export type Front = Record<string, FrontValue>;

const KEY = /^[a-z][a-z0-9_]{0,40}$/;

function scalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

export function withFrontmatter(fields: Front, body: string): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (!KEY.test(key)) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${JSON.stringify(item)}`);
    } else {
      lines.push(`${key}: ${scalar(value)}`);
    }
  }
  lines.push("---", "");
  return `${lines.join("\n")}${body.replace(/^\n+/, "")}`;
}

function parseScalar(raw: string): string | number | boolean | null {
  const value = raw.trim();
  if (value === "null" || value === "~" || value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith("\"")) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "string" ? parsed : value;
    } catch {
      return value.slice(1, value.endsWith("\"") ? -1 : undefined);
    }
  }
  return value;
}

export function readFrontmatter(text: string): { fields: Front; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { fields: {}, body: text };
  const fields: Front = {};
  let list: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && list) {
      const value = parseScalar(item[1]);
      (fields[list] as string[]).push(value === null ? "" : String(value));
      continue;
    }
    const pair = /^([a-z][a-z0-9_]{0,40}):(?:\s(.*))?$/.exec(line);
    if (!pair) continue;
    if (pair[2] === undefined || pair[2].trim() === "") {
      fields[pair[1]] = [];
      list = pair[1];
    } else {
      fields[pair[1]] = parseScalar(pair[2]);
      list = null;
    }
  }
  return { fields, body: text.slice(match[0].length) };
}

export const text = (value: FrontValue | undefined, fallback = ""): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback);
export const num = (value: FrontValue | undefined): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
export const list = (value: FrontValue | undefined): string[] => (Array.isArray(value) ? value.filter(item => typeof item === "string" && item) : []);
