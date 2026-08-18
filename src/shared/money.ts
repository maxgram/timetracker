export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function moneyMul(a: number, b: number): number {
  return roundMoney(a * b)
}

export function moneyAdd(a: number, b: number): number {
  return roundMoney(a + b)
}

export function moneyPct(amount: number, ratePct: number): number {
  return roundMoney((amount * ratePct) / 100)
}