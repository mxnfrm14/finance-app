ALTER TABLE "User" ADD COLUMN "aiProvider" TEXT;

CREATE TABLE "AiConnection" (
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "baseUrl" TEXT,
    "encryptedApiKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiConnection_pkey" PRIMARY KEY ("userId", "provider"),
    CONSTRAINT "AiConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Legacy AppConfig credentials have no owner. Do not assign or copy them to users.
