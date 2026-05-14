/**
 * Script de nettoyage : fusionne les positions dupliquées.
 * Critère de doublon : même (isin + accountType + brokerId + userId).
 *
 * Usage : npx tsx scripts/merge-duplicate-positions.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env" })

const connectionString = process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function computePru(
  positionId: string
): Promise<{ pru: number; quantity: number }> {
  const txs = await prisma.transaction.findMany({
    where: { positionId },
    orderBy: { date: "asc" },
  })

  let qty = 0
  let cost = 0

  for (const tx of txs) {
    if (tx.type === "BUY" || tx.type === "TRANSFER") {
      cost += tx.price * tx.quantity + tx.fees
      qty += tx.quantity
    } else if (tx.type === "SELL") {
      qty -= tx.quantity
    }
  }

  return { pru: qty > 0 ? cost / qty : 0, quantity: qty }
}

async function main() {
  const positions = await prisma.position.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  })

  // Grouper par (userId + isin + accountType + brokerId)
  const groups = new Map<string, typeof positions>()
  for (const pos of positions) {
    const key = `${pos.userId}|${pos.isin}|${pos.accountType}|${pos.brokerId}`
    const arr = groups.get(key) ?? []
    arr.push(pos)
    groups.set(key, arr)
  }

  let mergedCount = 0

  for (const [key, group] of groups) {
    if (group.length <= 1) continue

    console.log(`\n⚠️  Doublon détecté : ${key}`)
    console.log(`   ${group.length} positions pour le même ISIN/compte/courtier`)

    // Garder la plus ancienne (index 0, triée par createdAt asc)
    const [keep, ...duplicates] = group

    console.log(`   ✅ Conservée  : ${keep.id} (${keep.name}, créée le ${keep.createdAt.toLocaleDateString()})`)

    for (const dup of duplicates) {
      console.log(`   🔀 Fusion de  : ${dup.id} (créée le ${dup.createdAt.toLocaleDateString()})`)

      // Rattacher les transactions au doublon vers la position conservée
      const moved = await prisma.transaction.updateMany({
        where: { positionId: dup.id },
        data: { positionId: keep.id },
      })
      console.log(`      → ${moved.count} transaction(s) déplacée(s)`)

      // Marquer le doublon comme inactif
      await prisma.position.update({
        where: { id: dup.id },
        data: { isActive: false },
      })
    }

    // Recalculer PRU + quantité depuis toutes les transactions fusionnées
    const { pru, quantity } = await computePru(keep.id)
    await prisma.position.update({
      where: { id: keep.id },
      data: { pru, quantity },
    })
    console.log(`   📊 Cache mis à jour : quantité=${quantity}, PRU=${pru.toFixed(2)}`)

    mergedCount++
  }

  if (mergedCount === 0) {
    console.log("✅ Aucun doublon trouvé.")
  } else {
    console.log(`\n✅ ${mergedCount} groupe(s) fusionné(s) avec succès.`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
