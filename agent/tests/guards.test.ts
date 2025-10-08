import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_CONFIG } from "../src/config.js";
import { validateAction, underAllowed } from "../src/guards.js";

describe("underAllowed", () => {
  it("accepts paths within the root", () => {
    expect(underAllowed("/content/okta/marketing", ["/content/okta"]))
      .toBe(true);
  });

  it("rejects paths outside the root", () => {
    expect(underAllowed("/content/elsewhere", ["/content/okta"]))
      .toBe(false);
  });
});

describe("validateAction", () => {
  it("rejects disallowed template", () => {
    const violations = validateAction(
      {
        type: "CREATE_PAGE",
        parentPath: "/content/okta",
        name: "test",
        title: "Test",
        template: "/conf/okta/settings/wcm/templates/bad"
      },
      DEFAULT_AGENT_CONFIG
    );
    expect(violations).toContain("Template /conf/okta/settings/wcm/templates/bad is not allowed.");
  });

  it("enforces soft delete", () => {
    const violations = validateAction(
      {
        type: "DELETE_PAGE",
        path: "/content/okta/test",
        softDelete: false
      },
      DEFAULT_AGENT_CONFIG
    );
    expect(violations).toContain("Hard delete is prohibited. Use softDelete=true.");
  });

  it("allows valid update action", () => {
    const violations = validateAction(
      {
        type: "UPDATE_PAGE",
        path: "/content/okta/test",
        properties: { title: "Updated" }
      },
      DEFAULT_AGENT_CONFIG
    );
    expect(violations).toHaveLength(0);
  });
});
