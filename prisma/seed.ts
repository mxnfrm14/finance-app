import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Admin par défaut
  const adminPassword = await bcrypt.hash("admin1234", 12)
  const admin = await prisma.user.upsert({
    where: { email: "admin@bourse.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@bourse.local",
      passwordHash: adminPassword,
      role: "admin",
      language: "fr",
    },
  })
  console.log(`✅ Admin créé : ${admin.email} / admin1234`)

  // Courtier de démo
  await prisma.broker.upsert({
    where: { userId_slug: { userId: admin.id, slug: "fortuneo" } },
    update: {},
    create: { name: "Fortuneo", slug: "fortuneo", userId: admin.id },
  })
  await prisma.broker.upsert({
    where: { userId_slug: { userId: admin.id, slug: "degiro" } },
    update: {},
    create: { name: "DEGIRO", slug: "degiro", userId: admin.id },
  })
  console.log("✅ Courtiers de démo créés")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
