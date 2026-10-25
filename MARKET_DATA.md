# Market data provider configuration

The dashboard has no exchange or market-data provider credentials configured by default. In that state, the server returns a fixed local illustrative dataset so that analysts can demonstrate the layout, watchlist, chart controls, and alert workflow. The values and chart series are stable, explicitly labeled illustrative references; they are not exchange quotes, delayed data, historical market prices, actual contract expiries, trading volume, or exchange status. Illustrative volume and expiry are unavailable (`null`). Refreshing the fallback does not change its values.

When all provider environment variables are present, the application requests the configured authorized provider adapter. An accepted provider response replaces the illustrative dataset. A provider request error is shown as an error rather than falling back to fabricated values.

## Server environment

Set these values in `.env.local` for local development or in the deployment's server-side secret settings:

```dotenv
MARKET_DATA_PROVIDER=Your authorized provider
MARKET_DATA_API_URL=https://your-authorized-provider-or-adapter.example/api/market-data
MARKET_DATA_API_KEY=your-provider-issued-api-token
```

Do not prefix credentials with `NEXT_PUBLIC_`, expose them in browser code, or commit `.env.local`.

The project currently implements a server-side REST bearer-token adapter, not a provider-specific TrueData/MCX protocol client. Choose an authorized provider account with MCX instrument permissions, obtain its API token and permitted data entitlement (real-time or delayed), and use a provider-compatible adapter endpoint to normalize its response to the schema below. Confirm available instruments, expiry metadata, history ranges, rate limits, and WebSocket rights with the provider. If the provider offers streaming, a provider-specific server-side WebSocket adapter is needed; no WebSocket feed is claimed or configured here.

## REST response contract

The configured URL accepts an optional `range` query parameter (`1D`, `1W`, `1M`, or `1Y`) and must return JSON shaped as follows. Use `null` when an optional market field is unavailable; do not fill fields with estimates.

```json
{
  "provider": "Authorized provider name",
  "mode": "delayed",
  "updatedAt": "2026-10-25T11:45:00.000Z",
  "instruments": [
    {
      "symbol": "provider-supplied-contract-symbol",
      "name": "Provider-supplied instrument name",
      "category": "Gold",
      "instrumentType": "futures",
      "unit": "provider-supplied contract unit",
      "expiry": "2026-12-05",
      "price": 0,
      "previousClose": null,
      "change": null,
      "open": null,
      "high": null,
      "low": null,
      "volume": null,
      "history": {
        "1D": [
          {
            "timestamp": "2026-10-25T11:30:00.000Z",
            "open": 0,
            "high": 0,
            "low": 0,
            "close": 0,
            "volume": null
          }
        ]
      }
    }
  ]
}
```

`category` is `Gold`, `Silver`, or `Other`; `instrumentType` is `spot`, `futures`, or `other`. `mode` must be explicitly supplied as `real-time` or `delayed` by the trusted provider adapter. Include only instruments and fields actually supplied by the entitlement. The dashboard calculates percentage change from `price` and `previousClose` only when the provider omits `change`.

The server route validates the response and does not cache it. Provider errors are returned as errors; the UI retains the last successful snapshot as stale when possible and shows its timestamp and the error. When provider credentials are absent, it serves a deterministic local illustration set instead. That set is labeled as illustrative throughout; its fixed values and series are not real market history.
