import { randomUUID } from "node:crypto";
import { END, START, StateGraph } from "@langchain/langgraph";
import { AgentConfig, DEFAULT_AGENT_CONFIG } from "./config.js";
import { validateAction } from "./guards.js";
import {
  createPageWithTemplate,
  deletePage,
  publishPage,
  updatePageProperties
} from "./mcp.js";
import { Planner } from "./planner.js";
import { Action, AgentState, StepRecord } from "./types.js";

const MAX_STEPS = 8;

export interface PlannerLike {
  plan(state: AgentState): Promise<Action>;
}

type AgentUpdates = Partial<AgentState>;

type MutationAction = Extract<Action, { type: "CREATE_PAGE" | "UPDATE_PAGE" }>;

function buildGraph() {
  return new StateGraph<AgentState>({
    channels: {
      goal: { value: (_prev: string, next?: string) => (next ?? _prev), default: () => "" },
      steps: {
        value: (prev: StepRecord[], next?: StepRecord[]) => (next ? [...next] : prev),
        default: () => []
      },
      last_result: {
        value: (_prev: unknown, next?: unknown) => (typeof next === "undefined" ? _prev : next),
        default: () => undefined
      },
      violations: {
        value: (_prev: string[], next?: string[]) => (next ? [...next] : []),
        default: () => []
      },
      iterations: {
        value: (_prev: number, next?: number) => (typeof next === "number" ? next : _prev),
        default: () => 0
      },
      done: {
        value: (_prev: boolean, next?: boolean) => (typeof next === "boolean" ? next : _prev),
        default: () => false
      },
      context: {
        value: (prev: AgentState["context"], next?: AgentState["context"]) => ({
          ...prev,
          ...(next ?? {})
        }),
        default: () => ({})
      },
      pendingAction: {
        value: (_prev: Action | undefined, next?: Action) => next,
        default: () => undefined
      }
    }
  });
}

function trackMutation(context: AgentState["context"], path: string, action: MutationAction, stepIndex: number) {
  context.lastMutationPath = path;
  context.lastMutationType = action.type;
  context.lastSuccessfulMutationStep = stepIndex;
}

async function performExecution(
  action: Action,
  state: AgentState,
  config: AgentConfig
): Promise<AgentUpdates> {
  const steps = [...state.steps];
  const context = { ...state.context };
  const step: StepRecord = { action };

  const recordStep = (updates?: Partial<StepRecord>) => {
    Object.assign(step, updates);
    steps.push(step);
  };

  const success: AgentUpdates = { steps, context, violations: [] };

  try {
    switch (action.type) {
      case "CREATE_PAGE": {
        const idempotencyKey = randomUUID();
        const path = `${action.parentPath.replace(/\/$/, "")}/${action.name}`;
        const result = await createPageWithTemplate(action, idempotencyKey);
        recordStep({ result, idempotencyKey });
        success.last_result = result;
        trackMutation(context, path, action, steps.length);
        return success;
      }
      case "UPDATE_PAGE": {
        const idempotencyKey = randomUUID();
        const result = await updatePageProperties(action, idempotencyKey);
        recordStep({ result, idempotencyKey });
        success.last_result = result;
        trackMutation(context, action.path, action, steps.length);
        return success;
      }
      case "DELETE_PAGE": {
        const idempotencyKey = randomUUID();
        const result = await deletePage(action, idempotencyKey);
        recordStep({ result, idempotencyKey });
        success.last_result = result;
        return success;
      }
      case "PUBLISH_PAGE": {
        const { requireRecentChange, maxMutationGap } = config.publishPolicy;
        if (requireRecentChange) {
          const lastMutationStep = context.lastSuccessfulMutationStep ?? -Infinity;
          const lastMutationType = context.lastMutationType;
          if (lastMutationType !== "CREATE_PAGE" && lastMutationType !== "UPDATE_PAGE") {
            const violation = "Cannot publish without a successful create or update.";
            recordStep({ violations: [violation] });
            return {
              steps,
              context,
              last_result: { error: violation },
              violations: [violation]
            };
          }
          const distance = state.steps.length - lastMutationStep;
          if (distance > maxMutationGap) {
            const violation = `Publish must occur within ${maxMutationGap} steps of last mutation.`;
            recordStep({ violations: [violation] });
            return {
              steps,
              context,
              last_result: { error: violation },
              violations: [violation]
            };
          }
        }

        const idempotencyKey = randomUUID();
        const result = await publishPage(action, idempotencyKey);
        recordStep({ result, idempotencyKey });
        success.last_result = result;
        return success;
      }
      case "DONE": {
        recordStep({ result: { status: "DONE" } });
        return {
          steps,
          context,
          last_result: { status: "DONE" },
          done: true,
          violations: []
        };
      }
      default: {
        const exhaustive: never = action;
        throw new Error(`Unhandled action type ${(exhaustive as Action).type}`);
      }
    }
  } catch (error) {
    const violation = `Execution error: ${String(error)}`;
    recordStep({ violations: [violation] });
    return {
      steps,
      context,
      last_result: { error: violation },
      violations: [violation]
    };
  }
}

export function createAgentGraph(
  planner: PlannerLike,
  config: AgentConfig = DEFAULT_AGENT_CONFIG
) {
  const graph = buildGraph();

  graph.addNode("plan", async (state: AgentState): Promise<AgentUpdates> => {
    if (state.done || state.iterations >= MAX_STEPS) {
      return {};
    }

    const action = await planner.plan(state);
    const violations = validateAction(action, config);

    return {
      iterations: state.iterations + 1,
      pendingAction: action,
      violations
    } satisfies AgentUpdates;
  });

  graph.addNode("execute", async (state: AgentState): Promise<AgentUpdates> => {
    if (state.done || state.iterations > MAX_STEPS) {
      return {};
    }

    const action = state.pendingAction;
    if (!action) {
      return {};
    }

    if (state.violations && state.violations.length > 0) {
      const step: StepRecord = { action, violations: state.violations };
      return {
        steps: [...state.steps, step],
        pendingAction: undefined,
        last_result: { error: "Guard validation failed." }
      } satisfies AgentUpdates;
    }

    const updates = await performExecution(action, state, config);
    return {
      ...updates,
      pendingAction: undefined
    } satisfies AgentUpdates;
  });

  graph.addEdge(START, "plan");
  graph.addEdge("plan", "execute");
  graph.addConditionalEdges("execute", (state: AgentState) => {
    if (state.done || state.iterations >= MAX_STEPS) {
      return END;
    }
    return "plan";
  });

  return graph.compile();
}

export async function run(
  goal: string,
  planner: PlannerLike = new Planner(),
  config: AgentConfig = DEFAULT_AGENT_CONFIG
) {
  const app = createAgentGraph(planner, config);
  const initialState: AgentState = {
    goal,
    steps: [],
    iterations: 0,
    done: false,
    context: {},
    pendingAction: undefined,
    violations: [],
    last_result: undefined
  };
  return app.invoke(initialState);
}
