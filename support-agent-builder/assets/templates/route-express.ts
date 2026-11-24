import express from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { describeModelError, runAgent, type AgentMessage } from "./agent.js";
import type { Db } from "./db.js";

const MAX_STORED_MESSAGES = 80; // keeps each conversation (and its cost) bounded

const ChatBody = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2000),
});

/**
 * POST /chat  { conversationId?, message } → { conversationId, reply }
 *
 * Mount it with: app.use("/api/support", supportRouter(db))
 * ADAPT: for Next.js / NestJS, keep the same body (validate → load history → runAgent → save → reply)
 * in the framework's handler, and use the project's existing rate limiter.
 */
export function supportRouter(db: Db): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: "20kb" }));

  // Each chat call costs money, so limit it per IP. (Behind a proxy, set app.set("trust proxy", 1).)
  const limiter = rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false });

  router.post("/chat", limiter, async (req, res) => {
    const body = ChatBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Send a message between 1 and 2000 characters." });
      return;
    }
    const { conversationId, message } = body.data;

    try {
      let id = conversationId;
      let history: AgentMessage[] = [];

      if (id) {
        const { rows } = await db.query<{ messages: AgentMessage[] }>(
          "SELECT messages FROM support_conversations WHERE id = $1",
          [id],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: "Conversation not found. Start a new chat." });
          return;
        }
        history = rows[0].messages;
      } else {
        const { rows } = await db.query<{ id: string }>(
          "INSERT INTO support_conversations DEFAULT VALUES RETURNING id",
        );
        id = rows[0].id;
      }

      if (history.length >= MAX_STORED_MESSAGES) {
        res.status(409).json({ error: "This chat is getting long. Please start a new one." });
        return;
      }

      const result = await runAgent(history, message, db);

      await db.query("UPDATE support_conversations SET messages = $2::jsonb, updated_at = now() WHERE id = $1", [
        id,
        JSON.stringify(result.messages),
      ]);

      res.json({ conversationId: id, reply: result.reply });
    } catch (err) {
      const modelError = describeModelError(err);
      if (modelError) {
        res.status(modelError.status).json({ error: modelError.message });
      } else {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
      }
    }
  });

  return router;
}
