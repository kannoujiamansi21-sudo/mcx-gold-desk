import type { Instrument, MarketSnapshot } from '@/lib/market-data'

const sampleBars = (start: number, closes: number[]): NonNullable<Instrument['history']['1D']> =>
  closes.map((close, index) => {
    const previous = index === 0 ? start : closes[index - 1]
    const high = Math.max(previous, close) * 1.0012
    const low = Math.min(previous, close) * 0.9988
    return {
      timestamp: new Date(Date.UTC(2025, 0, 6, 4, index * 30)).toISOString(),
      open: previous,
      high,
      low,
      close,
      volume: null,
    }
  })

const goldSpotHistory = [72080, 72135, 72090, 72210, 72285, 72240, 72350, 72420, 72390, 72510, 72580, 72640]
const silverSpotHistory = [91840, 91720, 91680, 91590, 91640, 91510, 91420, 91530, 91480, 91340, 91210, 91280]
const goldNearHistory = [72120, 72180, 72140, 72260, 72320, 72300, 72410, 72490, 72460, 72570, 72630, 72710]
const goldFarHistory = [72430, 72480, 72460, 72550, 72620, 72610, 72720, 72780, 72760, 72850, 72910, 72980]
const silverNearHistory = [91920, 91810, 91780, 91690, 91740, 91610, 91540, 91620, 91590, 91440, 91330, 91410]
const silverFarHistory = [92310, 92220, 92180, 92120, 92160, 92080, 92010, 92090, 92030, 91920, 91840, 91910]

function illustrativeInstrument(
  symbol: string,
  name: string,
  category: 'Gold' | 'Silver',
  instrumentType: 'spot' | 'futures',
  unit: string,
  price: number,
  previousClose: number,
  high: number,
  low: number,
  closes: number[],
): Instrument {
  const history = sampleBars(closes[0], closes)
  const weekly = [...closes, ...closes.slice(2).map((close, index) => close + (index % 2 ? -18 : 24))]
  const monthly = [...weekly, ...weekly.slice(2).map((close, index) => close + (index % 2 ? -32 : 41))]
  const yearly = [...monthly, ...monthly.slice(2).map((close, index) => close + (index % 2 ? -55 : 62))]
  return {
    symbol,
    name,
    category,
    instrumentType,
    unit,
    expiry: null,
    price,
    previousClose,
    change: Number((((price - previousClose) / previousClose) * 100).toFixed(2)),
    open: closes[0],
    high,
    low,
    volume: null,
    history: {
      '1D': history,
      '1W': sampleBars(closes[0], weekly),
      '1M': sampleBars(closes[0], monthly),
      '1Y': sampleBars(closes[0], yearly),
    },
  }
}

export const illustrativeMarketSnapshot: MarketSnapshot = {
  provider: 'Illustrative local dataset',
  mode: 'delayed',
  updatedAt: '2025-01-06T10:00:00.000Z',
  instruments: [
    illustrativeInstrument('GOLD-SPOT', 'Gold spot reference', 'Gold', 'spot', '₹ / 10 g', 72640, 72336, 72640, 72080, goldSpotHistory),
    illustrativeInstrument('GOLD-NEAR', 'Gold futures · near illustration', 'Gold', 'futures', '₹ / 10 g', 72710, 72449, 72710, 72120, goldNearHistory),
    illustrativeInstrument('GOLD-FAR', 'Gold futures · far illustration', 'Gold', 'futures', '₹ / 10 g', 72980, 72720, 72980, 72430, goldFarHistory),
    illustrativeInstrument('SILVER-SPOT', 'Silver spot reference', 'Silver', 'spot', '₹ / kg', 91280, 91536, 91840, 91210, silverSpotHistory),
    illustrativeInstrument('SILVER-NEAR', 'Silver futures · near illustration', 'Silver', 'futures', '₹ / kg', 91410, 91629, 91920, 91330, silverNearHistory),
    illustrativeInstrument('SILVER-FAR', 'Silver futures · far illustration', 'Silver', 'futures', '₹ / kg', 91910, 92114, 92310, 91840, silverFarHistory),
  ],
}
