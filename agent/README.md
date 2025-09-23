# AEM LangGraph MCP Agent

This package contains a LangGraph-based agent that acts as an Adobe Experience Manager (AEM) content author. It plans, validates, and executes content operations exclusively through MCP HTTP tools with strict guardrails.

## Prerequisites

- Node.js 20+
- pnpm 8+
- An accessible MCP server endpoint (defaults to `http://localhost:3001`).
- `OPENAI_API_KEY` environment variable configured for planner usage.

## Installation

```bash
pnpm install
```

## Configuration

Runtime guardrails live in `src/config.ts`:

- `ALLOWED_ROOTS`: repository paths the agent can operate under.
- `ALLOWED_TEMPLATES`: templates approved for new pages.
- `PUBLISH_POLICY`: publish behaviour, such as requiring a recent mutation before publishing.

Adjust these constants as needed for your environment.

## Running the Agent

Invoke the CLI with a human goal:

```bash
pnpm agent "Create a landing page under /content/okta/marketing titled 'Zero Trust' with landing template, then publish"
```

The agent prints a JSON document describing its planning/execution steps and the last MCP response.

## Testing

Tests are powered by Vitest and rely on mocked MCP HTTP calls:

```bash
pnpm test
```

## Development

- `pnpm lint` – run ESLint on the TypeScript sources.
- `pnpm build` – compile sources to `dist/`.
- `pnpm agent` – execute the CLI runner.

## Extending Standard Operating Procedures

- Update `src/planner.ts` to adjust prompt engineering.
- Expand `src/guards.ts` with new validation rules.
- Add new MCP wrappers inside `src/mcp.ts` as additional tools become available.

All new behaviours should include tests in `tests/` to preserve determinism and guardrail coverage.
