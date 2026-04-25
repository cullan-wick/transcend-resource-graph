import type { ScoredResource } from "../matching/types";
import type { StudentProfile } from "../../types/profile";

export const ANTHROPIC_MODEL = "claude-sonnet-4-6";
export const PERSONALIZED_GUIDE_TOOL_NAME = "submit_personalized_guide";
const MAX_RESPONSE_TOKENS = 2500;

export type PersonalizedGuideDraftEntry = {
  resource_id: string;
  reason: string;
};

export type PersonalizedGuideDraft = {
  opening_note: string;
  tier_1_start_this_week: PersonalizedGuideDraftEntry[];
  tier_2_explore_this_month: PersonalizedGuideDraftEntry[];
  tier_3_bookmark_for_later: PersonalizedGuideDraftEntry[];
};

type JsonSchema = Record<string, unknown>;

type AnthropicMessageParam = {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

type AnthropicToolDefinition = {
  name: string;
  description: string;
  input_schema: JsonSchema;
};

type AnthropicToolChoice = {
  type: "tool";
  name: string;
  disable_parallel_tool_use?: boolean;
};

type AnthropicMessageCreateParams = {
  model: string;
  max_tokens: number;
  temperature?: number;
  system?: string;
  messages: AnthropicMessageParam[];
  tools?: AnthropicToolDefinition[];
  tool_choice?: AnthropicToolChoice;
};

type AnthropicToolUseBlock = {
  type: "tool_use";
  name: string;
  input: unknown;
};

type AnthropicTextBlock = {
  type: "text";
  text: string;
};

type AnthropicMessageResponse = {
  content: Array<AnthropicToolUseBlock | AnthropicTextBlock | Record<string, unknown>>;
  stop_reason?: string | null;
};

export type AnthropicClientLike = {
  messages: {
    create(params: AnthropicMessageCreateParams): Promise<AnthropicMessageResponse>;
  };
};

export type GeneratePersonalizedGuideDraftOptions = {
  profile: StudentProfile;
  scoredResources: ScoredResource[];
  anthropicClient?: AnthropicClientLike;
  apiKey?: string;
};

const SYSTEM_PROMPT = [
  "You write personalized startup resource guides for UW-Madison student founders.",
  `You must respond by calling the ${PERSONALIZED_GUIDE_TOOL_NAME} tool exactly once.`,
  "Never answer with free-form prose outside the tool call.",
  "Every reason must be exactly one sentence and 25 words or fewer.",
  "Use the candidate resource IDs exactly as provided.",
].join(" ");

type AnthropicModule = {
  default?: unknown;
  Anthropic?: unknown;
};

type AnthropicConstructor = new (options: { apiKey: string }) => AnthropicClientLike;

export async function createAnthropicClient(
  apiKey: string | undefined = process.env.ANTHROPIC_API_KEY,
): Promise<AnthropicClientLike> {
  const trimmedKey = apiKey?.trim();
  if (!trimmedKey) {
    throw new Error("Missing ANTHROPIC_API_KEY.");
  }

  const Anthropic = await loadAnthropicSdk();
  return new Anthropic({ apiKey: trimmedKey });
}

export async function generatePersonalizedGuideDraft(
  options: GeneratePersonalizedGuideDraftOptions,
): Promise<PersonalizedGuideDraft> {
  const scoredResources = options.scoredResources.slice(0, 25);
  const anthropicClient =
    options.anthropicClient ?? (await createAnthropicClient(options.apiKey));

  const response = await anthropicClient.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_RESPONSE_TOKENS,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildPersonalizationPrompt(options.profile, scoredResources),
      },
    ],
    tools: [buildPersonalizedGuideTool(scoredResources)],
    tool_choice: {
      type: "tool",
      name: PERSONALIZED_GUIDE_TOOL_NAME,
      disable_parallel_tool_use: true,
    },
  });

  const toolBlock = response.content.find(
    (block): block is AnthropicToolUseBlock =>
      block.type === "tool_use" &&
      "name" in block &&
      block.name === PERSONALIZED_GUIDE_TOOL_NAME,
  );

  if (!toolBlock) {
    const textReply = response.content
      .filter((block): block is AnthropicTextBlock => block.type === "text")
      .map((block) => block.text)
      .join(" ")
      .trim();
    throw new Error(
      `Anthropic did not return the ${PERSONALIZED_GUIDE_TOOL_NAME} tool output.${
        textReply ? ` Text reply: ${textReply}` : ""
      }`,
    );
  }

  return parsePersonalizedGuideDraft(toolBlock.input);
}

export function buildPersonalizationPrompt(
  profile: StudentProfile,
  scoredResources: ScoredResource[],
): string {
  const topResourcesJson = JSON.stringify(
    scoredResources.map(({ resource, score }) => ({
      score,
      resource: {
        id: resource.id,
        name: resource.name,
        category: resource.category,
        affiliation: resource.affiliation,
        resource_type: resource.resource_type,
        description: resource.description,
        stages: resource.stages,
        industries: resource.industries,
        business_models: resource.business_models,
        capital_type: resource.capital_type,
        bottleneck_tags: resource.bottleneck_tags,
        what_you_get: resource.what_you_get,
        how_to_access: resource.how_to_access,
        is_high_leverage_pick: resource.is_high_leverage_pick,
        deadline: resource.deadline ?? null,
        external_url: resource.external_url ?? null,
      },
    })),
    null,
    2,
  );

  return `You are writing a personalized startup resource guide for a UW-Madison student founder.

Their profile:
- Stage: ${labelForPrompt(profile.stage)}
- Industries: ${listForPrompt(profile.industries)}
- Business model: ${labelForPrompt(profile.business_model)}
- UW status: ${labelForPrompt(profile.uw_status)}, ${labelForPrompt(profile.college)}
- Team: ${labelForPrompt(profile.team_status)}, ${labelForPrompt(profile.technical_status)}
- Capital preference: ${labelForPrompt(profile.capital_preference)}
- Primary bottleneck: ${labelForPrompt(profile.primary_bottleneck)}
- Secondary bottlenecks: ${listForPrompt(profile.secondary_bottlenecks)}
- Additional context: ${profile.additional_context?.trim() || "None provided"}

Below are 25 candidate resources, pre-filtered and ranked for this student. Organize them into three tiers:

1. **Start this week** (3-5 resources) - highest-impact, actionable in the next 7 days, directly addresses their primary bottleneck.
2. **Explore this month** (6-10 resources) - valuable but need more setup or aren't immediately urgent.
3. **Bookmark for later** (remaining) - worth knowing about, relevant at a future stage or situation.

For each resource, write ONE sentence (max 25 words) explaining why it matches THIS specific student. Reference their stage, industry, bottleneck, or context explicitly. Do not write generic descriptions.

Guidelines:
- If a resource doesn't fit well, move it to "Bookmark for later" rather than forcing it into a higher tier.
- If the student's primary bottleneck is "funding" and a resource is a non-funding resource, it can still be top-tier if it addresses funding indirectly (for example, I-Corps for SBIR credential). Explain the connection.
- Don't mention the tier name in the one-sentence reason.
- Be specific. Say "Because you're at the MVP stage in biotech, Badger Tech Foundry's lab-to-market pathway fits" rather than "This is a great program for founders."

CANDIDATE RESOURCES (as JSON):
${topResourcesJson}`;
}

function buildPersonalizedGuideTool(
  scoredResources: ScoredResource[],
): AnthropicToolDefinition {
  const candidateIds = scoredResources.map(({ resource }) => resource.id);

  return {
    name: PERSONALIZED_GUIDE_TOOL_NAME,
    description:
      "Submit the personalized guide as JSON with three tiers and an opening note.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "opening_note",
        "tier_1_start_this_week",
        "tier_2_explore_this_month",
        "tier_3_bookmark_for_later",
      ],
      properties: {
        opening_note: {
          type: "string",
          description:
            "Two or three sentences summarizing the student's situation and pointing to the most critical one or two resources.",
        },
        tier_1_start_this_week: buildTierSchema(candidateIds),
        tier_2_explore_this_month: buildTierSchema(candidateIds),
        tier_3_bookmark_for_later: buildTierSchema(candidateIds),
      },
    },
  };
}

function buildTierSchema(candidateIds: string[]): JsonSchema {
  return {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["resource_id", "reason"],
      properties: {
        resource_id: {
          type: "string",
          enum: candidateIds,
        },
        reason: {
          type: "string",
          description:
            "One sentence, 25 words or fewer, referencing the student's specific stage, bottleneck, industry, or context.",
        },
      },
    },
  };
}

function parsePersonalizedGuideDraft(input: unknown): PersonalizedGuideDraft {
  const obj = expectRecord(input, "Anthropic guide tool input");
  return {
    opening_note: expectString(obj.opening_note, "opening_note"),
    tier_1_start_this_week: parseTierEntries(
      obj.tier_1_start_this_week,
      "tier_1_start_this_week",
    ),
    tier_2_explore_this_month: parseTierEntries(
      obj.tier_2_explore_this_month,
      "tier_2_explore_this_month",
    ),
    tier_3_bookmark_for_later: parseTierEntries(
      obj.tier_3_bookmark_for_later,
      "tier_3_bookmark_for_later",
    ),
  };
}

function parseTierEntries(
  input: unknown,
  fieldName: string,
): PersonalizedGuideDraftEntry[] {
  if (!Array.isArray(input)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return input.map((entry, index) => {
    const obj = expectRecord(entry, `${fieldName}[${index}]`);
    return {
      resource_id: expectString(obj.resource_id, `${fieldName}[${index}].resource_id`),
      reason: expectString(obj.reason, `${fieldName}[${index}].reason`),
    };
  });
}

function expectRecord(
  input: unknown,
  fieldName: string,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  return input as Record<string, unknown>;
}

function expectString(input: unknown, fieldName: string): string {
  if (typeof input !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  return input;
}

function labelForPrompt(value: string): string {
  return value
    .split("_")
    .map((segment) => {
      if (segment === "uw") return "UW";
      if (segment === "ai") return "AI";
      if (segment === "ml") return "ML";
      if (segment === "d2c") return "D2C";
      if (segment === "cdis") return "CDIS";
      if (segment === "vc") return "VC";
      return segment;
    })
    .join(" ");
}

function listForPrompt(values: string[]): string {
  if (values.length === 0) return "None";
  return values.map(labelForPrompt).join(", ");
}

async function loadAnthropicSdk(): Promise<AnthropicConstructor> {
  const failures: string[] = [];

  for (const moduleName of ["@anthropic-ai/sdk", "anthropic"] as const) {
    try {
      const mod = (await import(moduleName)) as AnthropicModule;
      const ctor = resolveAnthropicConstructor(mod);
      if (ctor) {
        return ctor;
      }
      failures.push(`${moduleName}: module loaded but no Anthropic constructor was found`);
    } catch (error) {
      failures.push(`${moduleName}: ${formatUnknownError(error)}`);
    }
  }

  throw new Error(
    "Anthropic SDK is unavailable. Install the official SDK package (`@anthropic-ai/sdk`) before running personalization. " +
      failures.join(" | "),
  );
}

function resolveAnthropicConstructor(
  mod: AnthropicModule,
): AnthropicConstructor | null {
  if (typeof mod.default === "function") {
    return mod.default as AnthropicConstructor;
  }
  if (typeof mod.Anthropic === "function") {
    return mod.Anthropic as AnthropicConstructor;
  }
  return null;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
