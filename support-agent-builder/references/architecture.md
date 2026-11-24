# Architecture

```
Client ──POST /api/support/chat──▶ route ──▶ agent loop ──▶ OpenAI or Claude
                                    │           │  ▲
                                    │           ▼  │ tool results
                                    │       tools.ts (search / lookup / ticket)
                                    ▼           │
                                 database ◀─────┘
                  (help content, customer records, tickets, conversations)
```

## The agent loop

One customer message = one call to `runAgent(history, userText, db)`:

1. Append the user message to the stored transcript.
2. Call the model with the system prompt, the tool list and the transcript.
3. If the model asks for tools, run **all** of them (in parallel), append the results, and go back to 2.
4. If it answers in text, return that text and the full transcript.
5. Stop after `MAX_STEPS` model calls (default 8) and return a fixed "please rephrase or I'll open a ticket" reply.

The transcript is stored **in the provider's own message format** (JSONB / JSON column) and only ever appended to. Don't rewrite or trim earlier messages in place. When a conversation hits the message cap, ask the customer to start a new chat.

## One prompt, one tool set, two providers

- `prompt.ts` and `tools.ts` are shared. Tool schemas are written once as strict JSON Schema (`additionalProperties: false`, every property in `required`), which both APIs accept.
- Each provider file only translates to its API's message shape:
  - **OpenAI** (Chat Completions): tool calls come back in `message.tool_calls`. Each result is its own `{ role: "tool", tool_call_id }` message, and `arguments` is a JSON **string** to parse.
  - **Claude** (Messages API): tool calls are `tool_use` content blocks. All results go back in **one** user message as `tool_result` blocks, and `input` is already an object. Always append the full `response.content`, not just its text.
- `agent.ts` picks the provider: `LLM_PROVIDER` if set, otherwise whichever API key is present.

## Designing tools

- **Few, sharp tools.** Three is usually enough. Each description says *when* to use it.
- **Inputs the model can't abuse.** Use enums for fixed choices, regexes for ID formats, and length limits on free text. Validate with Zod in code even though the schema is strict, because the schema can't carry every limit.
- **Return plain, short text or compact JSON.** Return only the fields the customer may see, never internal IDs, cost prices or other customers' data.
- **Errors are results, not exceptions.** Invalid input → `{ content: "Invalid input: ...", is_error: true }` so the model can correct itself. Unexpected exceptions → a fixed "Tool failed" result, logged server-side.
- **Search that admits ignorance.** When nothing matches, the tool result itself says "No matching help articles. Do not guess; offer a ticket."

## Mapping to common stacks

| Stack | Route | DB access |
|---|---|---|
| Express / Fastify | `route-express.ts` as is (Fastify: same body, different handler signature) | `pg` Pool, or the project's client behind the `Db` interface |
| Next.js App Router | `app/api/support/chat/route.ts` exporting `POST(req)`; body via `await req.json()` | Prisma/Drizzle: replace `db.query` calls with the ORM, keeping the ownership filter in the `where` |
| NestJS | A `SupportController` with `@Post('chat')`, the agent as an injectable service | The project's repository/service |

## Help content options

1. **Existing DB table / CMS:** query it directly. With Postgres, a generated `tsvector` column + GIN index gives good keyword search (see `schema.sql`).
2. **Markdown files in the repo:** load them at startup into memory, and score by keyword overlap (title matches weighted higher). This is fine for under a few hundred articles.
3. **Large or fuzzy content:** embeddings (pgvector or the project's vector store). Only add this if keyword search measurably misses. Start simple.
