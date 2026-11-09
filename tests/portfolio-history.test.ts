import assert from "node:assert/strict"
import { test } from "node:test"
import { buildPortfolioHistory, type HistoryPosition } from "../lib/portfolio/value-history"

const date = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T12:00:00.000Z`)
const buy = (day: number, quantity: number, price: number) => ({
  date: date(day), type: "BUY", quantity, price, fees: 0
})

test("adds every holding, including the same instrument in separate accounts", () => {
  const prices = [{ date: date(1), close: 100 }, { date: date(2), close: 110 }]
  const result = buildPortfolioHistory([
    { transactions: [buy(1, 2, 90)], prices },
    { transactions: [buy(1, 3, 90)], prices },
    { transactions: [buy(1, 4, 25)], prices: [{ date: date(1), close: 30 }] }
  ], date(1), date(2))
  assert.deepEqual(result.prices.map((row) => row.close), [620, 670])
  assert.equal(result.estimated, false)
})

test("uses quantities held on each date, including transactions before the selected period", () => {
  const position: HistoryPosition = {
    transactions: [
      buy(1, 10, 100),
      buy(3, 5, 120),
      { date: date(4), type: "SELL", quantity: 12, price: 130, fees: 0 },
      { date: date(5), type: "SELL", quantity: 3, price: 130, fees: 0 }
    ],
    prices: [{ date: date(1), close: 110 }, { date: date(3), close: 120 }]
  }
  const result = buildPortfolioHistory([position], date(2), date(5))
  assert.deepEqual(result.prices.map((row) => row.close), [1100, 1800, 360, 0])
})

test("carries the preceding close across market holidays without using future prices", () => {
  const result = buildPortfolioHistory([{
    transactions: [buy(1, 2, 50)],
    prices: [{ date: date(1), close: 60 }, { date: date(4), close: 80 }]
  }], date(2), date(4))
  assert.deepEqual(result.prices.map((row) => row.close), [120, 120, 160])
})

test("includes holdings with no ticker or missing prices at acquisition cost including fees", () => {
  const result = buildPortfolioHistory([{
    transactions: [{ ...buy(2, 2, 50), fees: 4 }],
    prices: [{ date: date(3), close: null }, { date: date(4), close: NaN }]
  }], date(1), date(4))
  assert.equal(result.prices[0].date, "2026-10-02")
  assert.deepEqual(result.prices.map((row) => row.close), [104, 104, 104])
  assert.equal(result.estimated, true)
})

test("ignores future transactions and does not invent history for an empty portfolio", () => {
  assert.deepEqual(buildPortfolioHistory([], date(1), date(3)).prices, [])
  const result = buildPortfolioHistory([{
    transactions: [buy(4, 10, 100)], prices: []
  }], date(1), date(3))
  assert.deepEqual(result.prices, [])
})
