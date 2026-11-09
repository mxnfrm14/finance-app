import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

function encryptionKey() {
  const secret = process.env.AI_ENCRYPTION_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("Configurez AI_ENCRYPTION_KEY (au moins 32 caractères) pour protéger les clés IA.")
  }
  return createHash("sha256").update(`bourse/ai-secrets/v1:${secret}`).digest()
}

export function encryptAiSecret(value: string, userId: string, provider: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  cipher.setAAD(Buffer.from(JSON.stringify([userId, provider])))
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".")
}

export function decryptAiSecret(value: string, userId: string, provider: string): string {
  try {
    const [version, iv, tag, encrypted, extra] = value.split(".")
    if (version !== "v1" || !iv || !tag || !encrypted || extra) throw new Error("Invalid format")
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"))
    decipher.setAAD(Buffer.from(JSON.stringify([userId, provider])))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    throw new Error("La clé IA ne peut pas être déchiffrée. Enregistrez-la à nouveau dans les paramètres.")
  }
}
