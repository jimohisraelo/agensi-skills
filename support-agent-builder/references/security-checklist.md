# Security checklist

Go through every item before you call the agent done. The core rule: **the model is never trusted for authorization.** Treat everything the model sends to a tool as untrusted user input, because a customer can steer it.

## Data access

- [ ] The record lookup filters by owner **in the query** (`WHERE id = $1 AND lower(email) = $2`, or the session user ID), not by checking afterwards in model-visible logic.
- [ ] "Not found" and "belongs to someone else" return the **same** message, so IDs can't be enumerated.
- [ ] If customers are logged in, ownership comes from the server session, not from an email the model passes.
- [ ] Tool results include only customer-visible fields.
- [ ] No tool can list records in bulk, search other customers, or run free-form queries.

## Inputs

- [ ] Every tool input is validated with Zod (format, length, enum) before use.
- [ ] All SQL is parameterised. No string-built queries from model output.
- [ ] Search queries are reduced to plain words (operators and punctuation stripped), and capped in length.
- [ ] The chat endpoint validates the request body (message 1–2,000 characters, conversation ID is a UUID).

## Cost and abuse

- [ ] Per-IP (or per-user) rate limit on the chat endpoint.
- [ ] Step cap per message (`MAX_STEPS`) and a message cap per conversation.
- [ ] Request body size limit (e.g. `express.json({ limit: "20kb" })`).
- [ ] Model errors map to safe customer messages (busy / not configured / try again), and details are only logged server-side.

## Actions

- [ ] The agent can't refund, cancel, change addresses or move money. Those go through `create_ticket` for a human.
- [ ] Tickets store the customer's email from validated input, and the ticket text is treated as untrusted when staff view it (escaped in any admin UI).
- [ ] Any admin endpoint (e.g. listing tickets) is behind real auth, or a constant-time token comparison at minimum, and is off when unconfigured.

## Output

- [ ] The UI renders replies as text (`textContent` / framework escaping), never `innerHTML`.
- [ ] The system prompt tells the agent not to reveal order details the tool didn't return, and not to invent policies, prices or dates.
- [ ] A refusal or empty model response maps to a fixed, polite fallback reply.

## Secrets

- [ ] API keys come from env vars only, `.env` is git-ignored, and `.env.example` lists the names without values.
