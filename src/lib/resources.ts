import fs from "node:fs";
import path from "node:path";
import type { Resource } from "../types/resource";

export function loadResources(
  filePath: string = path.resolve(process.cwd(), "data/resources.json"),
): Resource[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed as Resource[];
}
