import { NextResponse } from 'next/server'
import { illustrativeMarketSnapshot } from '@/lib/illustrative-market-data'
import { validateMarketSnapshot } from '@/lib/market-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const endpoint = process.env.MARKET_DATA_API_URL
  const apiKey = process.env.MARKET_DATA_API_KEY
  const providerName = process.env.MARKET_DATA_PROVIDER

  if (!endpoint || !apiKey || !providerName) {
    return NextResponse.json({
      connected: false,
      source: 'illustrative',
      provider: illustrativeMarketSnapshot.provider,
      mode: 'illustrative',
      updatedAt: illustrativeMarketSnapshot.updatedAt,
      instruments: illustrativeMarketSnapshot.instruments,
      error: null,
      notice: 'No authorized market-data provider is configured. Displaying fixed illustrative values only; these are not exchange quotes, live/delayed prices, volume, or contract expiries.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  let url: URL
  try {
    url = new URL(endpoint)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('The configured market data endpoint must use HTTPS.')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid market data endpoint.'
    return NextResponse.json({ error: message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  const range = new URL(request.url).searchParams.get('range')
  if (range && !['1D', '1W', '1M', '1Y'].includes(range)) {
    return NextResponse.json({ error: 'Unsupported chart range.' }, { status: 400 })
  }
  if (range) url.searchParams.set('range', range)

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      return NextResponse.json(
        { error: `Configured provider returned HTTP ${response.status}.` },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const payload: unknown = await response.json()
    const snapshot = validateMarketSnapshot(payload)
    return NextResponse.json({
      connected: true,
      source: 'provider',
      provider: snapshot.provider,
      mode: snapshot.mode,
      updatedAt: snapshot.updatedAt,
      instruments: snapshot.instruments,
      error: null,
      notice: null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read market data from the configured provider.'
    return NextResponse.json({ error: `Market data provider request failed: ${message}` }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
