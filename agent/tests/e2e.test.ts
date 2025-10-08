import { describe, expect, it, vi, beforeEach } from "vitest";
import { run } from "../src/run.js";
import type { Action, AgentState } from "../src/types.js";

vi.mock("../src/mcp.js", () => ({
  createPageWithTemplate: vi.fn().mockResolvedValue({ path: "/content/okta/marketing/zero-trust" }),
  updatePageProperties: vi.fn().mockResolvedValue({ ok: true }),
  deletePage: vi.fn(),
  publishPage: vi.fn().mockResolvedValue({ status: "activated" })
}));

const mcp = await import("../src/mcp.js");

class SequencePlanner {
  private index = 0;
  constructor(private readonly actions: Action[]) {}

  async plan(_state: AgentState): Promise<Action> {
    const action = this.actions[this.index] ?? { type: "DONE" as const };
    this.index += 1;
    return action;
  }
}

describe("agent happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates, updates, and publishes a page", async () => {
    const planner = new SequencePlanner([
      {
        type: "CREATE_PAGE",
        parentPath: "/content/okta/marketing",
        name: "zero-trust",
        title: "Zero Trust",
        template: "/conf/okta/settings/wcm/templates/landing-page",
        properties: { description: "Landing" }
      },
      {
        type: "UPDATE_PAGE",
        path: "/content/okta/marketing/zero-trust",
        properties: { title: "Zero Trust Landing" }
      },
      {
        type: "PUBLISH_PAGE",
        path: "/content/okta/marketing/zero-trust",
        activate: true
      },
      {
        type: "DONE",
        summary: "Workflow complete"
      }
    ]);

    const state = await run(
      "Create a landing page under /content/okta/marketing titled Zero Trust with landing template, then publish",
      planner
    );

    expect(state.done).toBe(true);
    expect(state.steps).toHaveLength(4);
    expect(mcp.createPageWithTemplate).toHaveBeenCalledTimes(1);
    expect(mcp.updatePageProperties).toHaveBeenCalledTimes(1);
    expect(mcp.publishPage).toHaveBeenCalledTimes(1);
    expect(state.steps[2].action.type).toBe("PUBLISH_PAGE");
    expect(state.last_result).toEqual({ status: "DONE" });
  });
});
