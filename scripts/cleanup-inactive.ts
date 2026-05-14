import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env" })

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const deleted = await prisma.position.deleteMany({ where: { isActive: false } })
  console.log(`✅ ${deleted.count} position(s) inactive(s) supprimée(s).`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
