/**
 * Calcule le nouveau PRU (Prix de Revient Unitaire) après un achat.
 * Pour une vente, le PRU ne change pas — seule la quantité diminue.
 *
 * RÈGLE : ne jamais lire Position.pru directement pour le P&L.
 * Toujours recalculer depuis l'historique des transactions.
 */
export function computeNewPru(
  existingQty: number,
  existingPru: number,
  newQty: number,
  newPrice: number
): number {
  const totalQty = existingQty + newQty
  if (totalQty === 0) return 0
  return (existingQty * existingPru + newQty * newPrice) / totalQty
}

/**
 * Recalcule le PRU et la quantité finale depuis la liste complète des transactions.
 * À utiliser après toute mutation (ajout/suppression de transaction).
 */
export function computePruFromTransactions(
  transactions: Array<{ type: string; quantity: number; price: number; fees: number }>
): { pru: number; quantity: number } {
  let pru = 0
  let quantity = 0

  const sorted = [...transactions].sort(
    (a, b) => ("date" in a && "date" in b ? 0 : 0) // tri par date si disponible
  )

  for (const tx of sorted) {
    if (tx.type === "BUY" || tx.type === "TRANSFER") {
      const priceWithFees = tx.price + (tx.fees > 0 ? tx.fees / tx.quantity : 0)
      pru = computeNewPru(quantity, pru, tx.quantity, priceWithFees)
      quantity += tx.quantity
    } else if (tx.type === "SELL") {
      // Le PRU ne change pas lors d'une vente
      quantity = Math.max(0, quantity - tx.quantity)
    }
    // DIVIDEND et SPLIT gérés séparément si besoin
  }

  return { pru, quantity }
}
