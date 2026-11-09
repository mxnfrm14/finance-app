ALTER TABLE "AgentSession"
ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Conversation',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "activeRunId" TEXT,
ADD COLUMN "runExpiresAt" TIMESTAMP(3);

UPDATE "AgentSession" SET "updatedAt" = "createdAt";
-- Legacy messages are text, so malformed historical JSON must not break migration.
DO $$
DECLARE item RECORD;
BEGIN
  FOR item IN SELECT "id", "messages" FROM "AgentSession" LOOP
    BEGIN
      UPDATE "AgentSession"
      SET "title" = COALESCE(NULLIF(LEFT(REGEXP_REPLACE(item."messages"::jsonb->0->>'content', '\s+', ' ', 'g'), 80), ''), 'Conversation')
      WHERE "id" = item."id";
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  END LOOP;
END $$;

CREATE INDEX "AgentSession_userId_updatedAt_id_idx" ON "AgentSession"("userId", "updatedAt", "id");
