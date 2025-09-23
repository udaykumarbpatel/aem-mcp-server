import { z } from "zod";

export const PropertiesSchema = z.record(z.string(), z.any()).default({});

export const CreatePageActionSchema = z.object({
  type: z.literal("CREATE_PAGE"),
  parentPath: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  template: z.string().min(1),
  properties: PropertiesSchema.optional()
});

export const UpdatePageActionSchema = z.object({
  type: z.literal("UPDATE_PAGE"),
  path: z.string().min(1),
  properties: PropertiesSchema
});

export const DeletePageActionSchema = z.object({
  type: z.literal("DELETE_PAGE"),
  path: z.string().min(1),
  softDelete: z.boolean()
});

export const PublishPageActionSchema = z.object({
  type: z.literal("PUBLISH_PAGE"),
  path: z.string().min(1),
  activate: z.boolean(),
  scheduleAt: z.string().datetime().optional().nullable()
});

export const DoneActionSchema = z.object({
  type: z.literal("DONE"),
  summary: z.string().optional()
});

export const ActionSchema = z.discriminatedUnion("type", [
  CreatePageActionSchema,
  UpdatePageActionSchema,
  DeletePageActionSchema,
  PublishPageActionSchema,
  DoneActionSchema
]);

export type Action = z.infer<typeof ActionSchema>;

export interface StepRecord {
  action: Action;
  result?: unknown;
  violations?: string[];
  idempotencyKey?: string;
}

export interface AgentContext {
  lastMutationPath?: string;
  lastMutationType?: "CREATE_PAGE" | "UPDATE_PAGE";
  lastSuccessfulMutationStep?: number;
}

export interface AgentState {
  goal: string;
  steps: StepRecord[];
  last_result?: unknown;
  violations?: string[];
  iterations: number;
  done: boolean;
  context: AgentContext;
  pendingAction?: Action;
}

export const INITIAL_STATE = Object.freeze({
  steps: [] as StepRecord[],
  iterations: 0,
  done: false,
  context: {} as AgentContext
});
