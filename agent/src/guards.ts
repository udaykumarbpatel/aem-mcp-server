import { AgentConfig, DEFAULT_AGENT_CONFIG } from "./config.js";
import { Action } from "./types.js";

export function underAllowed(path: string, roots: string[]): boolean {
  return roots.some((root) => path === root || path.startsWith(`${root}/`));
}

function isPublishAction(action: Action): action is Extract<Action, { type: "PUBLISH_PAGE" }> {
  return action.type === "PUBLISH_PAGE";
}

function isCreateAction(action: Action): action is Extract<Action, { type: "CREATE_PAGE" }> {
  return action.type === "CREATE_PAGE";
}

function isUpdateAction(action: Action): action is Extract<Action, { type: "UPDATE_PAGE" }> {
  return action.type === "UPDATE_PAGE";
}

function isDeleteAction(action: Action): action is Extract<Action, { type: "DELETE_PAGE" }> {
  return action.type === "DELETE_PAGE";
}

export function validateAction(action: Action, config: AgentConfig = DEFAULT_AGENT_CONFIG): string[] {
  const violations: string[] = [];

  if (isCreateAction(action)) {
    if (!underAllowed(action.parentPath, config.allowedRoots)) {
      violations.push(`Parent path ${action.parentPath} is outside of allowed roots.`);
    }
    if (!config.allowedTemplates.includes(action.template)) {
      violations.push(`Template ${action.template} is not allowed.`);
    }
  }

  if (isUpdateAction(action) || isDeleteAction(action) || isPublishAction(action)) {
    const targetPath = action.path;
    if (!underAllowed(targetPath, config.allowedRoots)) {
      violations.push(`Path ${targetPath} is outside of allowed roots.`);
    }
  }

  if (isDeleteAction(action)) {
    if (!action.softDelete) {
      violations.push("Hard delete is prohibited. Use softDelete=true.");
    }
  }

  if (isPublishAction(action)) {
    if (!action.activate) {
      violations.push("Publish actions must request activation (activate=true).");
    }
  }

  return violations;
}
