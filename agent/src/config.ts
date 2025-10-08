export const ALLOWED_ROOTS = [
  "/content/okta",
  "/content/my-site"
];

export const ALLOWED_TEMPLATES = [
  "/conf/okta/settings/wcm/templates/landing-page",
  "/conf/okta/settings/wcm/templates/press-release"
];

export const PUBLISH_POLICY = {
  requireRecentChange: true,
  maxMutationGap: 2
};

export interface PublishPolicyConfig {
  requireRecentChange: boolean;
  maxMutationGap: number;
}

export interface AgentConfig {
  allowedRoots: string[];
  allowedTemplates: string[];
  publishPolicy: PublishPolicyConfig;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  allowedRoots: ALLOWED_ROOTS,
  allowedTemplates: ALLOWED_TEMPLATES,
  publishPolicy: PUBLISH_POLICY
};
