import { prisma } from "@/lib/db/client"
import { AiSettingsStore } from "./settings-store"

export const aiSettings = new AiSettingsStore(prisma)
