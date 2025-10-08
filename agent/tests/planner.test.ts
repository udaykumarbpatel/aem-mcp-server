import { describe, expect, it, vi } from "vitest";
import { Planner } from "../src/planner.js";
import { AgentState } from "../src/types.js";

const baseState: AgentState = {
  goal: "Create a landing page",
  steps: [],
  iterations: 0,
  done: false,
  context: {},
  pendingAction: undefined
};

describe("Planner", () => {
  it("parses JSON action from OpenAI response", async () => {
    const action = {
      type: "DONE" as const,
      summary: "No work needed"
    };

    const mockClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify(action)
        })
      }
    } as any;

    const planner = new Planner({ client: mockClient });
    const planned = await planner.plan(baseState);
    expect(planned).toEqual(action);
    expect(mockClient.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-5-mini" })
    );
  });
});
