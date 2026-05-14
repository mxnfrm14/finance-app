export async function getEURRate(fromCurrency: string): Promise<number> {
  if (fromCurrency === "EUR") return 1
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=EUR`)
    if (!res.ok) return 1
    const data = await res.json()
    return (data.rates?.EUR as number) ?? 1
  } catch {
    return 1
  }
}
