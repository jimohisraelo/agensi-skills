-- Only create what the project doesn't already have. PostgreSQL 13+ (gen_random_uuid is built in).

-- Help-centre articles, searched with Postgres full-text search.
CREATE TABLE IF NOT EXISTS help_articles (
  id      SERIAL PRIMARY KEY,
  slug    TEXT NOT NULL UNIQUE,
  title   TEXT NOT NULL,
  body    TEXT NOT NULL,
  search  TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED
);
CREATE INDEX IF NOT EXISTS help_articles_search_idx ON help_articles USING GIN (search);

-- Hand-offs to a human.
CREATE TABLE IF NOT EXISTS tickets (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  summary     TEXT NOT NULL,
  priority    TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full agent transcripts (including tool calls), so a chat can continue across requests.
CREATE TABLE IF NOT EXISTS support_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messages    JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
