export type MarketCategory = 'Gold' | 'Silver' | 'Other'

export type PriceBar = {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

export type Instrument = {
  symbol: string
  name: string
  category: MarketCategory
  instrumentType: 'spot' | 'futures' | 'other'
  unit: string | null
  expiry: string | null
  price: number
  previousClose: number | null
  change: number | null
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  history: Partial<Record<'1D' | '1W' | '1M' | '1Y', PriceBar[]>>
}

export type MarketSnapshot = {
  provider: string
  mode: 'real-time' | 'delayed' | 'illustrative'
  updatedAt: string
  instruments: Instrument[]
}

export type MarketStatus = {
  connected: boolean
  source: 'provider' | 'illustrative' | null
  provider: string | null
  mode: 'real-time' | 'delayed' | 'illustrative' | null
  updatedAt: string | null
  instruments: Instrument[]
  error: string | null
  notice: string | null
}

export function validateMarketSnapshot(value: unknown): MarketSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Provider response must be a JSON object.')
  const candidate = value as Partial<MarketSnapshot>
  if (typeof candidate.provider !== 'string' || !candidate.provider.trim()) {
    throw new Error('Provider response must include a provider name.')
  }
  if (candidate.mode !== 'real-time' && candidate.mode !== 'delayed') {
    throw new Error('Provider response mode must be "real-time" or "delayed".')
  }
  if (typeof candidate.updatedAt !== 'string' || !Number.isFinite(Date.parse(candidate.updatedAt))) {
    throw new Error('Provider response must include a valid ISO update timestamp.')
  }
  if (!Array.isArray(candidate.instruments)) throw new Error('Provider response must include an instruments array.')

  const instruments = candidate.instruments.map((raw, index): Instrument => {
    if (!raw || typeof raw !== 'object') throw new Error(`Instrument ${index + 1} must be an object.`)
    const item = raw as Partial<Instrument>
    if (typeof item.symbol !== 'string' || !item.symbol.trim()) throw new Error(`Instrument ${index + 1} is missing symbol.`)
    if (typeof item.name !== 'string' || !item.name.trim()) throw new Error(`${item.symbol} is missing name.`)
    if (!['Gold', 'Silver', 'Other'].includes(String(item.category))) throw new Error(`${item.symbol} has an invalid category.`)
    if (!['spot', 'futures', 'other'].includes(String(item.instrumentType))) throw new Error(`${item.symbol} has an invalid instrumentType.`)
    if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price <= 0) {
      throw new Error(`${item.symbol} has an invalid price.`)
    }
    const nullableNumber = (key: 'previousClose' | 'change' | 'open' | 'high' | 'low' | 'volume') => {
      const field = item[key]
      if (field === null || field === undefined) return null
      if (typeof field !== 'number' || !Number.isFinite(field)) throw new Error(`${item.symbol} has an invalid ${key}.`)
      if (key !== 'change' && (key === 'volume' ? field < 0 : field <= 0)) {
        throw new Error(`${item.symbol} has an invalid ${key}.`)
      }
      return field
    }
    if (item.unit !== null && item.unit !== undefined && typeof item.unit !== 'string') {
      throw new Error(`${item.symbol} has an invalid unit.`)
    }
    if (item.expiry !== null && item.expiry !== undefined && typeof item.expiry !== 'string') {
      throw new Error(`${item.symbol} has an invalid expiry.`)
    }
    const history = item.history ?? {}
    if (typeof history !== 'object' || Array.isArray(history)) throw new Error(`${item.symbol} history must be an object.`)
    for (const range of ['1D', '1W', '1M', '1Y'] as const) {
      const bars = history[range]
      if (bars !== undefined && (!Array.isArray(bars) || bars.some(bar =>
        !bar || typeof bar.timestamp !== 'string' || !Number.isFinite(Date.parse(bar.timestamp)) ||
        !['open', 'high', 'low', 'close'].every(key => typeof bar[key as keyof PriceBar] === 'number' && Number.isFinite(bar[key as keyof PriceBar])) ||
        (bar.volume !== null && bar.volume !== undefined && (typeof bar.volume !== 'number' || !Number.isFinite(bar.volume)))
      ))) throw new Error(`${item.symbol} has invalid ${range} history.`)
    }
    return {
      symbol: item.symbol.trim(),
      name: item.name.trim(),
      category: item.category as MarketCategory,
      instrumentType: item.instrumentType as Instrument['instrumentType'],
      unit: item.unit ?? null,
      expiry: item.expiry ?? null,
      price: item.price,
      previousClose: nullableNumber('previousClose'),
      change: nullableNumber('change'),
      open: nullableNumber('open'),
      high: nullableNumber('high'),
      low: nullableNumber('low'),
      volume: nullableNumber('volume'),
      history: history as Instrument['history'],
    }
  })

  return {
    provider: candidate.provider.trim(),
    mode: candidate.mode,
    updatedAt: candidate.updatedAt,
    instruments,
  }
}
