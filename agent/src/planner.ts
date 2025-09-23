import OpenAI from "openai";
import { Action, ActionSchema, AgentState } from "./types.js";

const SYSTEM_PROMPT = `You are an Adobe Experience Manager (AEM) content author following standard operating procedures.
- You may only respond with a single JSON action conforming to the provided schema.
- Obey allowed content roots and templates.
- Prefer minimal, reversible steps.
- Never publish without a prior successful create or update in the current session.
- Use DELETE only as a soft delete.
- If the last step failed validation, correct course and try a compliant alternative.
`;

function formatHistory(state: AgentState): string {
  if (state.steps.length === 0) {
    return "No prior steps.";
  }

  return state.steps
    .map((step, index) => {
      const resultSummary = step.result ? JSON.stringify(step.result) : "{}";
      const violations = step.violations?.join("; ") ?? "none";
      return `${index + 1}. ${step.action.type} -> result=${resultSummary}, violations=${violations}`;
    })
    .join("\n");
}

export interface PlannerOptions {
  client?: OpenAI;
}

export class Planner {
  private readonly client: OpenAI;

  constructor(options: PlannerOptions = {}) {
    this.client =
      options.client ??
      new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        defaultHeaders: { "OpenAI-Beta": "assistants=v2" }
      });
  }

  async plan(state: AgentState): Promise<Action> {
    const messages = [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT
      },
      {
        role: "user" as const,
        content: `Goal: ${state.goal}\nIterations: ${state.iterations}\nLast result: ${JSON.stringify(state.last_result ?? {})}\nViolations: ${(state.violations ?? []).join("; ") || "none"}\nHistory:\n${formatHistory(state)}\nRespond with exactly one action as JSON.`
      }
    ];

    const response = await this.client.responses.create({
      model: "gpt-5-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      input: messages
    });

    const outputText = response.output_text ?? "";
    if (!outputText) {
      throw new Error("Planner did not return text output.");
    }

    const jsonStart = outputText.indexOf("{");
    const jsonString = jsonStart >= 0 ? outputText.slice(jsonStart) : outputText;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Planner response was not valid JSON: ${error}`);
    }

    return ActionSchema.parse(parsed);
  }
}

