import fs from "node:fs";
import path from "node:path";
import { filterResources } from "../src/lib/matching/filter";
import { rankResources } from "../src/lib/matching/score";
import { personalizeResources } from "../src/lib/llm/personalize";
import { loadResources } from "../src/lib/resources";
import type { StudentProfile } from "../src/types/profile";

// Input: single StudentProfile as JSON on stdin.
// Output: JSON to stdout with filtered count and top-25 scored list.
async function main() {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const input = Buffer.concat(chunks).toString("utf-8").trim();
  if (!input) {
    process.stderr.write("eval_entry: empty stdin\n");
    process.exit(2);
  }
  const profile = JSON.parse(input) as StudentProfile;

  const resourcesPath = path.resolve(process.cwd(), "data/resources.json");
  const resources = loadResources(resourcesPath);
  const filtered = filterResources(resources, profile);
  const top = rankResources(filtered, profile, 25);
  const includeLlm = process.env.EVAL_INCLUDE_LLM === "1";

  const guide = includeLlm ? await personalizeResources(profile, top) : null;

  const out = {
    total_resources: resources.length,
    filtered_count: filtered.length,
    top: top.map(({ resource, score }) => ({
      id: resource.id,
      name: resource.name,
      category: resource.category,
      affiliation: resource.affiliation,
      stages: resource.stages,
      industries: resource.industries,
      bottleneck_tags: resource.bottleneck_tags,
      is_high_leverage_pick: resource.is_high_leverage_pick,
      score,
    })),
    guide,
  };
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => {
  process.stderr.write(`eval_entry error: ${e?.stack ?? e}\n`);
  process.exit(1);
});
