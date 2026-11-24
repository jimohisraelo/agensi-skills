# Agent skills

## support-agent-builder

A skill for AI coding agents (Claude Code, Codex, Cursor) that adds a customer-support agent to an existing TypeScript/Node.js app:

- answers policy questions only from the app's own help content
- looks up a customer's orders, with the ownership check done in code (the model is never trusted for authorization)
- opens a ticket for a human when it can't help
- runs on OpenAI or Claude with tool calling, with a step cap, input validation and rate limiting
- ships with behaviour evals, including a prompt-injection test

Based on [helpdesk-agent](https://github.com/jimohisraelo/helpdesk-agent). Templates are type-checked against the same SDK versions.

```
support-agent-builder/
  SKILL.md                     workflow the agent follows
  references/                  architecture, security checklist, evals guide
  assets/templates/            TypeScript templates with ADAPT: markers
```

Install for Claude Code: copy `support-agent-builder/` into `~/.claude/skills/` (or `.claude/skills/` in a project), then ask: "add a support agent to this app".
