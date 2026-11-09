import { computeNewPru } from "./pru-calculator"

export type PortfolioHistoryRow = { date: string; close: number }

export type HistoryPosition = {
  transactions: {
    date: Date | string
    type: string
    quantity: number
    price: number
    fees: number
  }[]
  prices: { date: Date | string; close: number | null }[]
}

const day = (value: Date | string) => new Date(value).toISOString().slice(0, 10)

/** Value the quantities actually held on each date, carrying prices over market holidays. */
export function buildPortfolioHistory(positions: HistoryPosition[], start: Date, end: Date) {
  const states = positions.map((position) => ({
    transactions: [...position.transactions].sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    prices: position.prices
      .filter((price) => price.close !== null && Number.isFinite(price.close))
      .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    transactionIndex: 0,
    priceIndex: 0,
    quantity: 0,
    pru: 0,
    price: null as number | null
  }))
  const firstTransaction = states.flatMap((state) => state.transactions)
    .filter((transaction) => transaction.type === "BUY" || transaction.type === "TRANSFER")
    .map((transaction) => day(transaction.date)).sort()[0]
  const prices: PortfolioHistoryRow[] = []
  let estimated = false
  if (!firstTransaction) return { prices, estimated }

  const cursor = new Date(`${[day(start), firstTransaction].sort()[1]}T00:00:00.000Z`)
  const endDay = day(end)
  while (day(cursor) <= endDay) {
    const date = day(cursor)
    let total = 0
    for (const state of states) {
      while (state.transactionIndex < state.transactions.length &&
        day(state.transactions[state.transactionIndex].date) <= date) {
        const transaction = state.transactions[state.transactionIndex++]
        if (transaction.type === "BUY" || transaction.type === "TRANSFER") {
          const cost = transaction.price + (transaction.fees > 0 ? transaction.fees / transaction.quantity : 0)
          state.pru = computeNewPru(state.quantity, state.pru, transaction.quantity, cost)
          state.quantity += transaction.quantity
        } else if (transaction.type === "SELL") {
          state.quantity = Math.max(0, state.quantity - transaction.quantity)
        }
      }
      while (state.priceIndex < state.prices.length && day(state.prices[state.priceIndex].date) <= date) {
        state.price = state.prices[state.priceIndex++].close
      }
      if (state.quantity > 0) {
        total += state.quantity * (state.price ?? state.pru)
        if (state.price === null) estimated = true
      }
    }
    prices.push({ date, close: total })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return { prices, estimated }
}
