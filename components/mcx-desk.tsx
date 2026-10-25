'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell,
  Bookmark, Check, ChevronDown, ChevronRight, Clock3, Database, FileText,
  Gem, LayoutDashboard, LineChart, Menu, Plus, RefreshCw, Search, Settings,
  SlidersHorizontal, Star, Trash2, TrendingUp, X, Layers3, Ruler,
} from 'lucide-react'
import type { Instrument, MarketStatus, PriceBar } from '@/lib/market-data'

type PageId = 'Dashboard' | 'Live Markets' | 'Gold' | 'Silver' | 'Commodity Analysis' | 'Charts' | 'Watchlist' | 'Alerts' | 'Reports' | 'Settings'
type AlertRule = { id: string; symbol: string; direction: 'above' | 'below'; target: number; createdAt: string }
type Range = '1D' | '1W' | '1M' | '1Y'
type ActivityItem = { id: string; message: string; time: string }

const navigation: { label: PageId; icon: typeof Activity }[] = [
  { label: 'Dashboard', icon: LayoutDashboard }, { label: 'Live Markets', icon: Activity },
  { label: 'Gold', icon: Gem }, { label: 'Silver', icon: LineChart },
  { label: 'Commodity Analysis', icon: SlidersHorizontal }, { label: 'Charts', icon: LineChart },
  { label: 'Watchlist', icon: Star }, { label: 'Alerts', icon: Bell },
  { label: 'Reports', icon: FileText }, { label: 'Settings', icon: Settings },
]
const ranges: Range[] = ['1D', '1W', '1M', '1Y']
const watchlistKey = 'mcx-watchlist-v2'
const alertsKey = 'mcx-alerts-v2'
const refreshKey = 'mcx-refresh-interval-v1'

const descriptions: Record<PageId, string> = {
  Dashboard: 'Commodity research workspace · MCX references and futures context.',
  'Live Markets': 'Instrument monitor · values are labeled by source and connection state.',
  Gold: 'Gold spot references and futures contracts in the current dataset.',
  Silver: 'Silver spot references and futures contracts in the current dataset.',
  'Commodity Analysis': 'Cross-contract context, term structure, and same-unit spreads.',
  Charts: 'Historical or illustrative closing-price series for the selected instrument.',
  Watchlist: 'Instruments saved in this browser, matched against the current dataset.',
  Alerts: 'Browser-local thresholds evaluated against available dataset updates.',
  Reports: 'A report of the current dataset and its source.',
  Settings: 'Configure local dashboard preferences and view server connection requirements.',
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatChartTime(value: string | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatChange(value: number | null) {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function getChange(instrument: Instrument) {
  if (instrument.change !== null) return instrument.change
  if (instrument.previousClose === null) return null
  return ((instrument.price - instrument.previousClose) / instrument.previousClose) * 100
}

function classForChange(value: number | null) {
  return value === null ? '' : value >= 0 ? 'positive' : 'negative'
}

function returnDispersion(bars: PriceBar[]) {
  const returns = bars.slice(1).flatMap((bar, index) => {
    const previous = bars[index].close
    return previous > 0 ? [((bar.close - previous) / previous) * 100] : []
  })
  if (returns.length < 2) return null
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance)
}

function Section({ title, detail, action, children, className = '' }: {
  title: string
  detail?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return <section className={`panel ${className}`}>
    <div className="panel-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>
    {children}
  </section>
}

function MarketChart({ bars, instrument, range, illustrative }: { bars: PriceBar[]; instrument: Instrument; range: Range; illustrative: boolean }) {
  if (!bars.length) return <div className="empty-state"><LineChart /><div><strong>No {range} history available</strong><p>{illustrative ? 'This illustrative series has no values for this range.' : 'The configured provider must return historical bars for this instrument and range.'}</p></div></div>
  const width = 720
  const height = 160
  const values = bars.map(bar => bar.close)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1
  const coords = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width
    const y = height - ((value - min) / spread) * (height - 16) - 8
    return `${x},${y}`
  }).join(' ')
  const positive = (getChange(instrument) ?? 0) >= 0
  return <div className="chart-frame">
    <svg viewBox={`0 0 ${width} 180`} preserveAspectRatio="none" role="img" aria-label={`${instrument.name} ${illustrative ? 'illustrative' : 'provider-supplied'} ${range} closing price history`}>
      <g className="chart-grid"><path d="M0 25H720M0 65H720M0 105H720M0 145H720" /></g>
      <polyline points={coords} className={`chart-line ${positive ? '' : 'down'}`} />
    </svg>
    <div className="chart-axis"><span>{illustrative ? 'ILLUSTRATION START' : formatChartTime(bars[0]?.timestamp)}</span><span>{illustrative ? 'MID-SERIES' : formatChartTime(bars[Math.floor(bars.length / 2)]?.timestamp)}</span><span>{illustrative ? 'ILLUSTRATION END' : formatChartTime(bars[bars.length - 1]?.timestamp)}</span></div>
    <p className="chart-caption">{illustrative ? `Illustrative fixed series · ${range} · ${bars.length} points · not historical exchange prices` : `${instrument.name} · provider ${range} history · ${bars.length} bars · close price`}</p>
  </div>
}

function MarketStructure({ instruments, illustrative }: { instruments: Instrument[]; illustrative: boolean }) {
  const contracts = instruments.filter(item => item.instrumentType === 'futures')
  const sorted = [...contracts].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    if (a.unit !== b.unit) return (a.unit ?? '').localeCompare(b.unit ?? '')
    if (a.expiry && b.expiry) return Date.parse(a.expiry) - Date.parse(b.expiry)
    const tenor = (name: string) => name.toLowerCase().includes('near') ? 0 : name.toLowerCase().includes('far') ? 1 : 2
    return tenor(a.name) - tenor(b.name)
  })
  const pairs = (['Gold', 'Silver'] as const).flatMap(category => {
    const groups = new Map<string, Instrument[]>()
    for (const item of contracts.filter(item => item.category === category && item.unit)) {
      const group = groups.get(item.unit!) ?? []
      group.push(item)
      groups.set(item.unit!, group)
    }
    const group = [...groups.values()].map(items => {
      if (illustrative) return items.sort((a, b) => {
        const tenor = (name: string) => name.toLowerCase().includes('near') ? 0 : name.toLowerCase().includes('far') ? 1 : 2
        return tenor(a.name) - tenor(b.name)
      })
      return items.filter(item => item.expiry && Number.isFinite(Date.parse(item.expiry)))
        .sort((a, b) => Date.parse(a.expiry!) - Date.parse(b.expiry!))
    }).find(items => items.length >= 2) ?? []
    const near = group[0]
    const far = group[group.length - 1]
    if (!near || !far || near.symbol === far.symbol || near.unit !== far.unit) return []
    return [{ category, near, far, spread: far.price - near.price, percent: ((far.price - near.price) / near.price) * 100 }]
  })

  return <div className="structure-grid">
    <Section title="Futures term structure" detail={illustrative ? 'Illustrative near/far ladder · no exchange expiry dates' : 'Expiry order and contract units from provider'}>
      {sorted.length ? <div className="table-scroll"><table className="structure-table"><thead><tr><th>Contract</th><th>Tenor / expiry</th><th>Unit</th><th className="align-right">Price</th></tr></thead><tbody>
        {sorted.map((item, index) => <tr key={item.symbol}><td><strong>{item.symbol}</strong><small className="table-subline">{item.name}</small></td><td>{illustrative ? item.name.toLowerCase().includes('far') ? 'Far · illustrative' : 'Near · illustrative' : item.expiry ? formatDate(item.expiry) : 'Expiry unavailable'}</td><td>{item.unit ?? '—'}</td><td className="align-right">{formatPrice(item.price)}</td></tr>)}
      </tbody></table><p className="table-footnote">{illustrative ? 'No real contract maturity or exchange expiry is represented in the sample.' : 'Contracts without provider expiry metadata are shown as unavailable.'}</p></div> : <div className="empty-state"><Layers3 /><div><strong>No futures contracts supplied</strong><p>The current source has no futures series for term-structure analysis.</p></div></div>}
    </Section>
    <Section title="Relative value" detail={illustrative ? 'Fixed illustrative values · same category and unit only' : 'Outright spread between same-category, same-unit futures'}>
      {pairs.length ? <div className="table-scroll"><table className="structure-table"><thead><tr><th>Pair</th><th>Unit</th><th className="align-right">Spread</th><th className="align-right">%</th></tr></thead><tbody>
        {pairs.map(pair => <tr key={pair.category}><td><strong>{pair.near.symbol} / {pair.far.symbol}</strong><small className="table-subline">Far less near</small></td><td>{pair.near.unit}</td><td className={`align-right ${pair.spread >= 0 ? 'positive' : 'negative'}`}>{pair.spread > 0 ? '+' : ''}{formatPrice(pair.spread)}</td><td className={`align-right ${pair.percent >= 0 ? 'positive' : 'negative'}`}>{pair.percent > 0 ? '+' : ''}{pair.percent.toFixed(2)}%</td></tr>)}
      </tbody></table></div> : <div className="empty-state"><Ruler /><div><strong>Relative value unavailable</strong><p>At least two futures with matching category and units are needed.</p></div></div>}
      <div className="structure-note"><AlertTriangle />Spread is an arithmetic comparison only, not a recommendation. No spot/futures or cross-unit comparisons.</div>
    </Section>
  </div>
}

export default function McxDesk() {
  const [page, setPage] = useState<PageId>('Dashboard')
  const [range, setRange] = useState<Range>('1D')
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [alerts, setAlerts] = useState<AlertRule[]>([])
  const [snapshot, setSnapshot] = useState<MarketStatus>({
    connected: false, source: null, provider: null, mode: null, updatedAt: null, instruments: [], error: null, notice: null,
  })
  const [loading, setLoading] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(0)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('symbol')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [alertModal, setAlertModal] = useState(false)
  const [editingAlert, setEditingAlert] = useState<AlertRule | null>(null)
  const [alertSymbol, setAlertSymbol] = useState('')
  const [alertDirection, setAlertDirection] = useState<'above' | 'below'>('above')
  const [alertTarget, setAlertTarget] = useState('')
  const [toast, setToast] = useState('')
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [lastSuccess, setLastSuccess] = useState<string | null>(null)
  const previousPrices = useRef<Record<string, number>>({})
  const alertedOnResponse = useRef(false)
  const firedIllustrativeAlerts = useRef(new Set<string>())
  const alertsRef = useRef(alerts)
  alertsRef.current = alerts

  const loadMarketData = useCallback(async (requestedRange: Range = range, manual = false) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market-data?range=${requestedRange}`, { cache: 'no-store' })
      const result = await response.json() as MarketStatus
      if (!response.ok) throw new Error(result.error || `Market data request failed (${response.status}).`)
      if (!result.connected && result.error) {
        setSnapshot({ ...result, instruments: [] })
        return
      }
      const priceMap: Record<string, number> = {}
      for (const instrument of result.instruments) priceMap[instrument.symbol] = instrument.price
      let triggeredAlertCount = 0
      if (alertedOnResponse.current) {
        const triggered = alertsRef.current.filter(alert => {
          const current = priceMap[alert.symbol]
          if (current === undefined) return false
          if (result.source === 'illustrative') {
            const meetsThreshold = alert.direction === 'above' ? current >= alert.target : current <= alert.target
            return manual && meetsThreshold && !firedIllustrativeAlerts.current.has(alert.id)
          }
          const prior = previousPrices.current[alert.symbol]
          if (prior === undefined) return false
          return alert.direction === 'above'
            ? prior < alert.target && current >= alert.target
            : prior > alert.target && current <= alert.target
        })
        if (triggered.length) {
          triggeredAlertCount = triggered.length
          const messages = triggered.map(alert => result.source === 'illustrative'
            ? `${alert.symbol} illustrative value meets ${alert.direction} ₹${formatPrice(alert.target)}`
            : `${alert.symbol} crossed ${alert.direction} ₹${formatPrice(alert.target)}`)
          if (result.source === 'illustrative') triggered.forEach(alert => firedIllustrativeAlerts.current.add(alert.id))
          setActivity(items => [...messages.map(message => ({ id: crypto.randomUUID(), message, time: new Date().toLocaleTimeString() })), ...items].slice(0, 12))
          setToast(messages.join(' · '))
        }
      }
      previousPrices.current = priceMap
      alertedOnResponse.current = true
      setSnapshot(result)
      if (result.connected) setLastSuccess(result.updatedAt)
      if (manual && triggeredAlertCount === 0) {
        setToast(result.source === 'illustrative'
          ? 'Fixed illustrative snapshot reloaded. Values did not change; no exchange was contacted.'
          : `Provider data refreshed from ${result.provider}.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected market data request error.'
      setSnapshot(current => ({ ...current, connected: current.instruments.length > 0, error: message }))
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setWatchlist(readStored(watchlistKey, []))
    setAlerts(readStored(alertsKey, []))
    setRefreshInterval(readStored(refreshKey, 0))
    setPreferencesLoaded(true)
    const queryPage = new URLSearchParams(window.location.search).get('view')
    if (navigation.some(item => item.label === queryPage)) setPage(queryPage as PageId)
    const handlePopState = () => {
      const current = new URLSearchParams(window.location.search).get('view')
      setPage(navigation.some(item => item.label === current) ? current as PageId : 'Dashboard')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => { if (preferencesLoaded && !writeStored(watchlistKey, watchlist)) setToast('Could not save the watchlist in this browser.') }, [preferencesLoaded, watchlist])
  useEffect(() => { if (preferencesLoaded && !writeStored(alertsKey, alerts)) setToast('Could not save alerts in this browser.') }, [alerts, preferencesLoaded])
  useEffect(() => { if (preferencesLoaded && !writeStored(refreshKey, refreshInterval)) setToast('Could not save the refresh preference in this browser.') }, [preferencesLoaded, refreshInterval])
  useEffect(() => { void loadMarketData(range) }, [loadMarketData, range])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (!refreshInterval || !snapshot.connected) return
    const timer = window.setInterval(() => { void loadMarketData(range) }, refreshInterval * 1000)
    return () => window.clearInterval(timer)
  }, [loadMarketData, range, refreshInterval, snapshot.connected])

  const instruments = snapshot.instruments
  const selected = instruments.find(item => item.symbol === selectedSymbol) ?? instruments[0]
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const result = instruments.filter(item => {
      const matchesCategory = filter === 'All' || item.category === filter
      const matchesPage = page === 'Gold' ? item.category === 'Gold' : page === 'Silver' ? item.category === 'Silver' : true
      const matchesWatchlist = page !== 'Watchlist' || watchlist.includes(item.symbol)
      const matchesSearch = !query || `${item.symbol} ${item.name} ${item.category} ${item.instrumentType}`.toLowerCase().includes(query)
      return matchesCategory && matchesPage && matchesWatchlist && matchesSearch
    })
    return [...result].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price
      if (sort === 'price-desc') return b.price - a.price
      if (sort === 'change') return (getChange(b) ?? -Infinity) - (getChange(a) ?? -Infinity)
      return a.symbol.localeCompare(b.symbol)
    })
  }, [filter, instruments, page, search, sort, watchlist])
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    return instruments.filter(item =>
      !query || `${item.symbol} ${item.name} ${item.category} ${item.instrumentType}`.toLowerCase().includes(query),
    )
  }, [instruments, search])

  function notify(message: string) { setToast(message) }
  function logActivity(message: string) {
    setActivity(items => [{ id: crypto.randomUUID(), message, time: new Date().toLocaleTimeString() }, ...items].slice(0, 12))
  }
  function navigate(nextPage: PageId) {
    setPage(nextPage)
    setMobileOpen(false)
    setSearch('')
    setSearchOpen(false)
    setNotificationsOpen(false)
    setProfileOpen(false)
    const nextUrl = new URL(window.location.href)
    if (nextPage === 'Dashboard') nextUrl.searchParams.delete('view')
    else nextUrl.searchParams.set('view', nextPage)
    window.history.pushState({ view: nextPage }, '', nextUrl)
    if (nextPage === 'Gold') setSelectedSymbol(instruments.find(item => item.category === 'Gold')?.symbol ?? '')
    if (nextPage === 'Silver') setSelectedSymbol(instruments.find(item => item.category === 'Silver')?.symbol ?? '')
  }
  function toggleWatchlist(symbol: string) {
    const adding = !watchlist.includes(symbol)
    setWatchlist(current => adding ? [...current, symbol] : current.filter(item => item !== symbol))
    const message = `${symbol} ${adding ? 'added to' : 'removed from'} watchlist`
    logActivity(message)
    notify(message)
  }
  function openAlert(rule?: AlertRule) {
    setEditingAlert(rule ?? null)
    setAlertSymbol(rule?.symbol ?? selected?.symbol ?? instruments[0]?.symbol ?? '')
    setAlertDirection(rule?.direction ?? 'above')
    setAlertTarget(rule ? String(rule.target) : '')
    setAlertModal(true)
  }
  function saveAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = Number(alertTarget)
    if (!instruments.some(item => item.symbol === alertSymbol)) { notify('Select an instrument currently supplied by the provider.'); return }
    if (!Number.isFinite(target) || target <= 0) { notify('Enter a valid target price greater than zero.'); return }
    const rule: AlertRule = {
      id: editingAlert?.id ?? `${Date.now()}`,
      symbol: alertSymbol,
      direction: alertDirection,
      target,
      createdAt: editingAlert?.createdAt ?? new Date().toLocaleString(),
    }
    setAlerts(current => editingAlert ? current.map(item => item.id === rule.id ? rule : item) : [rule, ...current])
    setAlertModal(false)
    logActivity(`${editingAlert ? 'Updated' : 'Created'} ${rule.symbol} local price alert`)
    notify('Alert saved locally. It triggers only when a successful refresh crosses its target.')
  }
  function deleteAlert(id: string) {
    setAlerts(current => current.filter(item => item.id !== id))
    logActivity('Deleted a local price alert')
    notify('Price alert deleted.')
  }
  function selectInstrument(symbol: string) {
    setSelectedSymbol(symbol)
    setSearch('')
    setSearchOpen(false)
    navigate('Charts')
  }

  const marketState = snapshot.connected
    ? snapshot.error ? 'stale' : 'connected'
    : snapshot.error?.startsWith('Market data is disconnected.') ? 'disconnected'
      : snapshot.error ? 'error' : 'disconnected'
  const mainView = page === 'Dashboard' || page === 'Live Markets' || page === 'Gold' || page === 'Silver' || page === 'Charts' || page === 'Watchlist'

  return <div className="desk-shell">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><span>M</span></div><div><strong>MCX GOLD DESK</strong><small>MARKET INTELLIGENCE</small></div><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X /></button></div>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav className="navigation" aria-label="Main navigation">{navigation.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} aria-current={page === label ? 'page' : undefined} onClick={() => navigate(label)}><Icon /><span>{label}</span>{label === 'Alerts' && alerts.length > 0 && <small>{alerts.length}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className={`status-dot ${marketState === 'connected' ? '' : 'muted-dot'}`} /><span>{snapshot.source === 'illustrative' ? 'Illustrative · feed off' : marketState === 'connected' ? 'Provider connected' : 'Provider disconnected'}</span></div><button className="nav-item" onClick={() => navigate('Settings')}><Settings /><span>Preferences</span></button></div>
    </aside>

    <main className="workspace">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu /></button><div className="breadcrumb"><span>MCX GOLD DESK</span><ChevronRight /><b>{page}</b></div></div>
        <div className="topbar-actions">
          <span className={`market-status ${marketState === 'connected' ? 'positive' : ''}`}><i className={`status-dot ${marketState === 'connected' ? '' : 'muted-dot'}`} />{snapshot.source === 'illustrative' ? 'ILLUSTRATIVE · FEED OFF' : marketState === 'connected' ? `${snapshot.provider} · ${snapshot.mode}` : 'DATA FEED DISCONNECTED'}</span>
          <div className="search-wrap"><Search /><input aria-label="Search instruments" placeholder="Search instruments" value={search} onChange={event => { setSearch(event.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onKeyDown={event => { if (event.key === 'Enter' && searchResults[0]) selectInstrument(searchResults[0].symbol); if (event.key === 'Escape') setSearchOpen(false) }} />
            {searchOpen && <div className="search-results">{searchResults.length ? searchResults.slice(0, 8).map(item => <button key={item.symbol} onMouseDown={event => event.preventDefault()} onClick={() => selectInstrument(item.symbol)}><span><strong>{item.symbol}</strong><small>{item.name} · {item.instrumentType}</small></span><ChevronRight /></button>) : <p>{loading ? 'Loading instruments…' : 'No matching instruments in the current dataset.'}</p>}</div>}
          </div>
          <div className="menu-anchor"><button className={`icon-button ${notificationsOpen ? 'pressed' : ''}`} aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }}><Bell />{alerts.length > 0 && <i className="notification-dot" />}</button>
            {notificationsOpen && <div className="pop-menu notification-menu"><div className="pop-heading"><strong>Notifications</strong><span>Local</span></div>
              <p><AlertCircle />{snapshot.error ?? (snapshot.connected ? `Provider updated ${formatDate(snapshot.updatedAt)}.` : snapshot.error ?? 'No provider connection. Local alerts are not evaluated until data is connected.')}</p>
              {activity.filter(item => item.message.includes('crossed') || item.message.includes('meets')).slice(0, 4).map(item => <div className="activity-row" key={item.id}><span className="activity-icon"><Bell /></span><span>{item.message}</span><small>{item.time}</small></div>)}
              <button className="menu-action" onClick={() => navigate('Alerts')}>Manage price alerts <ChevronRight /></button></div>}
          </div>
          <div className="menu-anchor"><button className="profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false) }} aria-expanded={profileOpen}><span className="avatar">MD</span><span className="profile-label">Local workspace</span><ChevronDown /></button>
            {profileOpen && <div className="pop-menu profile-menu"><div className="profile-card"><span className="avatar">MD</span><span><strong>MCX Gold Desk</strong><small>Local prototype · no account linked</small></span></div><button className="menu-action" onClick={() => navigate('Settings')}><Settings />Settings</button></div>}
          </div>
        </div>
      </header>

      <div className="page-content" onClick={() => searchOpen && setSearchOpen(false)}>
        <div className="page-title-row"><div><p className="eyebrow">MCX GOLD DESK <span>/</span> MARKET INTELLIGENCE</p><h1>{page}</h1><p className="page-description">{descriptions[page]}</p></div><button className="button button-secondary" onClick={() => { void loadMarketData(range, true) }} disabled={loading}><RefreshCw />{loading ? 'Updating…' : 'Refresh data'}</button></div>
        <div className={`data-disclaimer connection-banner ${snapshot.source === 'illustrative' ? 'illustrative' : marketState}`}><AlertTriangle /><span><strong>{snapshot.source === 'illustrative' ? 'ILLUSTRATIVE DATA · NOT AN EXCHANGE FEED' : marketState === 'connected' ? 'AUTHORIZED PROVIDER' : marketState === 'stale' ? 'STALE PROVIDER DATA' : marketState === 'error' ? 'PROVIDER ERROR' : 'DISCONNECTED'}</strong> — {snapshot.error ?? snapshot.notice ?? (snapshot.connected ? `${snapshot.provider} · ${snapshot.mode} · updated ${formatDate(snapshot.updatedAt)}.` : 'No market data is available.')}</span></div>

        {loading && !snapshot.instruments.length && <Section title="Connecting to market data" detail="Requesting a fresh provider snapshot"><div className="empty-state"><RefreshCw /><div><strong>Loading provider data</strong><p>The dashboard will show instruments only after a successful, validated server response.</p></div></div></Section>}
        {marketState === 'disconnected' && !loading && !snapshot.instruments.length && <Section title="Market data unavailable" detail="Provider integration is not configured">
          <div className="empty-state"><Database /><div><strong>No real market data connected</strong><p>Configure an authorized provider endpoint, server-side API key, and provider name. The endpoint must return the documented normalized JSON schema; the dashboard will remain empty until a valid response succeeds.</p></div><button className="button button-secondary" onClick={() => navigate('Settings')}>View requirements</button></div>
        </Section>}
        {marketState === 'error' && !snapshot.instruments.length && <Section title="Market data request failed" detail="No provider response was accepted"><div className="empty-state"><AlertTriangle /><div><strong>Provider error</strong><p>{snapshot.error}</p></div><button className="button button-secondary" onClick={() => { void loadMarketData(range) }}>Retry</button></div></Section>}
        {snapshot.connected && !loading && !snapshot.instruments.length && <Section title="No instruments returned" detail={`${snapshot.provider} connected · ${snapshot.mode} data`}>
          <div className="empty-state"><Database /><div><strong>The provider response contains no instruments</strong><p>Check your MCX entitlement, instrument subscriptions, and provider-side normalized response.</p></div></div>
        </Section>}

        {mainView && snapshot.instruments.length > 0 && <>
          {page === 'Dashboard' && <section className="market-overview">
            <div className="overview-heading"><span>MARKET OVERVIEW</span><small>{snapshot.source === 'illustrative' ? 'Fixed reference set · no live quotes' : `${snapshot.provider} · ${snapshot.mode}`}</small></div>
            <div className="market-strip summary-strip">
              {(['Gold', 'Silver'] as const).map(category => {
                const item = instruments.find(candidate => candidate.category === category && candidate.instrumentType === 'spot')
                  ?? instruments.find(candidate => candidate.category === category)
                if (!item) return null
                const change = getChange(item)
                return <button className={`quote-card summary-quote ${category.toLowerCase()}-summary`} key={category} onClick={() => { setSelectedSymbol(item.symbol); navigate(category) }}>
                  <span className="quote-name"><span className={`commodity-token ${category.toLowerCase()}`}>{category === 'Gold' ? <Gem /> : <Layers3 />}</span>{category}<small>{item.instrumentType === 'spot' ? 'Spot reference' : 'Futures reference'}</small></span>
                  <strong>{formatPrice(item.price)}<small>{item.unit ?? 'unit unavailable'}</small></strong>
                  <span className={`quote-change ${classForChange(change)}`}>{change === null ? 'Change n/a' : <>{change >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}{formatChange(change)}</>}</span>
                  <span className="summary-symbol">{item.symbol}</span>
                </button>
              })}
            </div>
          </section>}
          {page === 'Live Markets' && <div className="market-strip">
            {instruments.map(item => {
              const change = getChange(item)
              return <button className={`quote-card ${selected?.symbol === item.symbol ? 'quote-active' : ''}`} key={item.symbol} onClick={() => setSelectedSymbol(item.symbol)}>
                <span className="quote-name">{item.symbol}<small>{item.instrumentType === 'spot' ? 'Spot' : item.instrumentType === 'futures' ? `Futures${item.expiry ? ` · ${item.expiry}` : ''}` : item.instrumentType}</small></span>
                <strong>₹{formatPrice(item.price)}</strong><span className={`quote-change ${classForChange(change)}`}>{change === null ? null : change >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}{formatChange(change)}</span>
              </button>
            })}
          </div>}
          {(page === 'Dashboard' || page === 'Charts') && selected && <div className="main-grid">
            <Section title={`${selected.symbol} · Price chart`} detail={`${selected.name} · ${selected.unit ?? 'unit not supplied'} · ${selected.instrumentType}${selected.expiry ? ` · Expiry ${selected.expiry}` : ''}`} className="chart-panel">
              <div className="chart-summary"><div><span>{snapshot.source === 'illustrative' ? 'ILLUSTRATIVE REFERENCE' : 'PROVIDER PRICE'}</span><strong>₹{formatPrice(selected.price)}</strong></div><div className={classForChange(getChange(selected))}><span>CHANGE</span><strong>{formatChange(getChange(selected))}</strong></div></div>
              <div className="chart-controls"><label className="select-label"><span>Contract</span><select aria-label="Chart instrument" value={selected.symbol} onChange={event => setSelectedSymbol(event.target.value)}>{instruments.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.instrumentType}</option>)}</select></label><div className="range-tabs" role="group" aria-label="Chart time range">{ranges.map(item => <button key={item} className={range === item ? 'selected' : ''} aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>)}</div></div>
              <MarketChart bars={selected.history[range] ?? []} instrument={selected} range={range} illustrative={snapshot.source === 'illustrative'} />
            </Section>
            <Section title="Contract details" detail={snapshot.source === 'illustrative' ? 'Available illustrative reference fields' : 'Fields supplied by provider'}>
              <div className="context-stat"><span>Previous close</span><strong>{selected.previousClose === null ? '—' : `₹${formatPrice(selected.previousClose)}`}</strong></div>
              <div className="context-stat"><span>Open</span><strong>{selected.open === null ? '—' : `₹${formatPrice(selected.open)}`}</strong></div>
              <div className="context-stat"><span>High / low</span><strong>{selected.high === null ? '—' : `₹${formatPrice(selected.high)}`} / {selected.low === null ? '—' : `₹${formatPrice(selected.low)}`}</strong></div>
              <div className="context-stat"><span>Volume</span><strong>{selected.volume === null ? '—' : formatPrice(selected.volume)}</strong></div>
              <div className="context-stat"><span>{snapshot.source === 'illustrative' ? 'Illustrative range span' : 'High–low range'}</span><strong>{selected.high !== null && selected.low !== null && selected.price > 0 ? `${(((selected.high - selected.low) / selected.price) * 100).toFixed(2)}%` : '—'}</strong></div>
              <div className="context-stat"><span>{snapshot.source === 'illustrative' ? 'Illustrative return dispersion' : 'Bar-return dispersion · unannualized'}</span><strong>{returnDispersion(selected.history[range] ?? []) === null ? '—' : `${returnDispersion(selected.history[range] ?? [])?.toFixed(3)}%`}</strong></div>
              <div className="context-stat"><span>Type / expiry</span><strong>{selected.instrumentType} · {selected.expiry ?? 'not supplied'}</strong></div>
              <div className="insight-box"><span className="insight-label"><Activity /> {snapshot.source === 'illustrative' ? 'ILLUSTRATIVE CONTEXT' : 'PROVIDER CONTEXT'}</span><p>{selected.unit ? `Contract unit: ${selected.unit}. ` : 'Contract unit not supplied. '}Values are not compared across instruments or units.</p></div>
            </Section>
          </div>}
          {(page === 'Dashboard' || page === 'Live Markets' || page === 'Gold' || page === 'Silver' || page === 'Watchlist') && <Section title={page === 'Watchlist' ? 'Saved instruments' : snapshot.source === 'illustrative' ? 'Illustrative instrument set' : 'Provider instruments'} detail={snapshot.source === 'illustrative' ? 'Fixed demonstration values · no exchange data' : 'Sort and filter fields supplied by the provider'}>
            <div className="table-toolbar"><label className="select-label"><span>Category</span><select value={filter} onChange={event => setFilter(event.target.value)}><option>All</option><option>Gold</option><option>Silver</option><option>Other</option></select></label><label className="select-label"><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="symbol">Symbol</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="change">Change: high to low</option></select></label></div>
            {filteredRows.length ? <div className="table-scroll"><table><thead><tr><th>Instrument / contract</th><th className="align-right">{snapshot.source === 'illustrative' ? 'Illustrative price' : 'Provider price'}</th><th className="align-right">Change</th><th className="align-right">OHLC high / low</th><th className="align-right">Volume</th><th>Expiry</th><th>Watchlist</th></tr></thead><tbody>
              {filteredRows.map(item => <tr key={item.symbol}><td><button className="instrument-link" onClick={() => setSelectedSymbol(item.symbol)}><strong>{item.symbol}</strong><small>{item.name} · {item.instrumentType} · {item.unit ?? 'unit unavailable'}</small></button></td>
                <td className="align-right price-cell">₹{formatPrice(item.price)}<small>{item.unit ?? 'unit not supplied'}</small></td><td className={`align-right ${classForChange(getChange(item))}`}>{formatChange(getChange(item))}</td>
                <td className="align-right">{item.high === null ? '—' : `₹${formatPrice(item.high)}`} / {item.low === null ? '—' : `₹${formatPrice(item.low)}`}</td><td className="align-right">{item.volume === null ? '—' : formatPrice(item.volume)}</td><td>{item.expiry ?? (snapshot.source === 'illustrative' && item.instrumentType === 'futures' ? 'Illustrative only' : '—')}</td>
                <td><button className={`watch-button ${watchlist.includes(item.symbol) ? 'watching' : ''}`} onClick={() => toggleWatchlist(item.symbol)} aria-label={`${watchlist.includes(item.symbol) ? 'Remove' : 'Add'} ${item.symbol} ${watchlist.includes(item.symbol) ? 'from' : 'to'} watchlist`}><Bookmark />{watchlist.includes(item.symbol) ? 'Saved' : 'Add'}</button></td></tr>)}
            </tbody></table></div> : <div className="empty-state"><Search /><div><strong>{page === 'Watchlist' && !watchlist.length ? 'Watchlist is empty' : 'No instruments match this view'}</strong><p>{page === 'Watchlist' && !watchlist.length ? 'Use Add in a provider instrument row to save it.' : 'Try a different search or category filter.'}</p></div><button className="text-button" onClick={() => { setSearch(''); setFilter('All') }}>Clear filters</button></div>}
          </Section>}
        </>}

        {(page === 'Dashboard' || page === 'Commodity Analysis') && snapshot.instruments.length > 0 && <MarketStructure instruments={instruments} illustrative={snapshot.source === 'illustrative'} />}

        {page === 'Commodity Analysis' && snapshot.instruments.length > 0 && <Section title="Market context" detail={snapshot.source === 'illustrative' ? 'Calculated from fixed illustrative values · not live volatility' : 'Descriptive calculations from provider-returned fields'}>
          <div className="context-stat"><span>Returned instruments</span><strong>{instruments.length}</strong></div>
          <div className="context-stat"><span>Gold contracts</span><strong>{instruments.filter(item => item.category === 'Gold').length}</strong></div>
          <div className="context-stat"><span>Silver contracts</span><strong>{instruments.filter(item => item.category === 'Silver').length}</strong></div>
          <div className="context-stat"><span>Data source / mode</span><strong>{snapshot.provider} · {snapshot.mode}</strong></div>
          <div className="context-stat"><span>Exchange volume</span><strong>{instruments.some(item => item.volume !== null) ? 'Provider supplied (per instrument)' : 'Unavailable'}</strong></div>
          <div className="insight-box"><span className="insight-label"><Activity /> ANALYTICAL LIMITATION</span><p>Support/resistance and annualized volatility are not inferred from illustrative series. Spot and futures contracts and incompatible units are not directly compared.</p></div>
        </Section>}

        {page === 'Alerts' && <Section title="Price alerts" detail={snapshot.source === 'illustrative' ? 'Local thresholds can be evaluated against the fixed sample when you manually refresh.' : 'Alerts are checked when fresh provider data successfully arrives.'} action={<button className="button button-primary" onClick={() => openAlert()} disabled={!instruments.length}><Plus />Create alert</button>}>
          {alerts.length ? <div className="alert-list">{alerts.map(alert => <div className="alert-row" key={alert.id}><div className="alert-symbol"><Bell /><span><strong>{alert.symbol}</strong><small>Saved {alert.createdAt}</small></span></div><p>Price {alert.direction} <strong>₹{formatPrice(alert.target)}</strong></p><div className="row-actions"><button className="text-button" onClick={() => openAlert(alert)}>Edit</button><button className="icon-button danger-button" aria-label={`Delete ${alert.symbol} alert`} onClick={() => deleteAlert(alert.id)}><Trash2 /></button></div></div>)}</div> : <div className="empty-state"><Bell /><div><strong>No price alerts</strong><p>{instruments.length ? 'Create a threshold to evaluate against future provider refreshes.' : 'Connect a provider before creating alerts for provider instruments.'}</p></div><button className="button button-primary" disabled={!instruments.length} onClick={() => openAlert()}><Plus />Create alert</button></div>}
          <div className="alert-caption"><AlertTriangle />No background monitoring occurs while the app is closed. Illustrative thresholds trigger only when manually reloaded and already satisfied; provider alerts require a newly observed crossing.</div>
        </Section>}

        {page === 'Reports' && <><Section title="Provider snapshot report" detail="Current provider response; not a historical export">
          <div className="context-stat"><span>Provider</span><strong>{snapshot.provider ?? 'Not connected'}</strong></div><div className="context-stat"><span>Data mode</span><strong>{snapshot.mode ?? 'Unavailable'}</strong></div><div className="context-stat"><span>Data timestamp</span><strong>{formatDate(snapshot.updatedAt ?? lastSuccess)}</strong></div><div className="context-stat"><span>Instrument rows</span><strong>{instruments.length}</strong></div>
          {instruments.length > 0 && <div className="table-scroll"><table><thead><tr><th>Symbol</th><th>Type</th><th>Price</th><th>Change</th><th>Expiry</th></tr></thead><tbody>{instruments.map(item => <tr key={item.symbol}><td>{item.symbol}</td><td>{item.instrumentType}</td><td>{formatPrice(item.price)} {item.unit ?? ''}</td><td className={classForChange(getChange(item))}>{formatChange(getChange(item))}</td><td>{item.expiry ?? '—'}</td></tr>)}</tbody></table></div>}
        </Section><Section title="Recent activity" detail="Local browser session">{activity.length ? activity.map(item => <div className="activity-row" key={item.id}><span className="activity-icon"><Clock3 /></span><span>{item.message}</span><small>{item.time}</small></div>) : <div className="empty-state"><Clock3 /><div><strong>No recent actions</strong><p>Watchlist and alert changes will appear here.</p></div></div>}</Section></>}

        {page === 'Settings' && <><Section title="Refresh preference" detail="Choose an interval allowed by your provider subscription"><div className="settings-row"><div><strong>Automatic polling</strong><p>Polling runs only while this page is open and an authorized provider is connected. Fixed illustrative values are never polled.</p></div><select aria-label="Refresh interval" value={refreshInterval} onChange={event => setRefreshInterval(Number(event.target.value))}><option value={0}>Manual only</option><option value={60}>Every minute</option><option value={300}>Every 5 minutes</option></select></div><div className="settings-note"><Database />Refresh interval is a local preference; confirm provider rate limits before enabling polling.</div></Section>
          <Section title="Provider configuration" detail="Credentials must remain on the server">
            <div className="settings-note"><AlertTriangle />No live market-data provider is currently connected. Add these server environment variables in .env.local or your deployment secret settings:</div>
            <div className="provider-config"><code>MARKET_DATA_PROVIDER</code><span>Authorized provider display name (for example, your TrueData account/provider label).</span><code>MARKET_DATA_API_URL</code><span>HTTPS URL for your authorized, normalized REST endpoint.</span><code>MARKET_DATA_API_KEY</code><span>Provider-issued API token; never expose it in client code or commit it.</span></div>
            <p className="table-footnote">Required: an active provider subscription with MCX permissions and an endpoint that returns the normalized schema documented in the project’s market-data route. Confirm permitted delay, instrument coverage, polling limits, and WebSocket rights with the provider. No provider-specific endpoint or credentials are assumed.</p>
          </Section></>}

        {mainView && snapshot.instruments.length > 0 && <div className="bottom-grid">
          <Section title="Saved instruments" detail={`${watchlist.length} in this browser`} action={<button className="text-button" onClick={() => navigate('Watchlist')}>Watchlist <ChevronRight /></button>}>
            {watchlist.length ? watchlist.map(symbol => {
              const item = instruments.find(instrument => instrument.symbol === symbol)
              if (!item) return null
              return <div className="mini-alert" key={symbol}><Star /><span><strong>{item.symbol}</strong><small>{formatPrice(item.price)} {item.unit ?? ''}</small></span><button className="text-button" onClick={() => toggleWatchlist(symbol)}>Remove</button></div>
            }) : <div className="inline-empty"><span>No saved instruments</span><button className="text-button" onClick={() => navigate('Watchlist')}>Browse <ChevronRight /></button></div>}
          </Section>
          <Section title="Price alerts" detail="Browser-local rules" action={<button className="text-button" onClick={() => navigate('Alerts')}>View all <ChevronRight /></button>}>{alerts.length ? alerts.slice(0, 3).map(alert => <div className="mini-alert" key={alert.id}><Bell /><span><strong>{alert.symbol}</strong><small>{alert.direction} ₹{formatPrice(alert.target)}</small></span><button className="text-button" onClick={() => openAlert(alert)}>Edit</button></div>) : <div className="inline-empty"><span>No alerts created</span><button className="text-button" onClick={() => openAlert()}>Create one <Plus /></button></div>}</Section>
          <Section title="Recent activity" detail="Local actions" action={<button className="text-button" onClick={() => navigate('Reports')}>Reports <ChevronRight /></button>}>{activity.slice(0, 3).map(item => <div className="mini-activity" key={item.id}><Check /><span>{item.message}</span></div>)}{!activity.length && <div className="inline-empty">No activity recorded.</div>}</Section>
        </div>}
      </div>
      <footer className="statusbar"><span><Database />Source: <b>{snapshot.provider ?? 'Not configured'}</b></span><span><Clock3 />{snapshot.source === 'illustrative' ? 'Illustrative series date: 06 Jan 2025 · fixed sample, not update time' : `Last successful update: ${formatDate(lastSuccess)}`}</span><span><AlertTriangle />{snapshot.connected ? snapshot.mode : 'No exchange connection'}</span></footer>
    </main>

    {alertModal && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAlertModal(false) }}><form className="alert-modal" onSubmit={saveAlert}>
      <div className="modal-heading"><div><p className="eyebrow">LOCAL ALERT RULE</p><h2>{editingAlert ? 'Edit price alert' : 'Create price alert'}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setAlertModal(false)}><X /></button></div>
      <p className="modal-description">This browser evaluates the rule only when a new provider response arrives. It does not monitor prices while closed.</p>
      <label className="form-field">Instrument<select value={alertSymbol} required onChange={event => setAlertSymbol(event.target.value)}>{instruments.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol} — {item.name}</option>)}</select></label>
      <div className="form-split"><label className="form-field">Condition<select value={alertDirection} onChange={event => setAlertDirection(event.target.value as 'above' | 'below')}><option value="above">Price rises above</option><option value="below">Price falls below</option></select></label><label className="form-field">Target price<input type="number" min="0.01" step="0.01" required value={alertTarget} onChange={event => setAlertTarget(event.target.value)} placeholder="Target" /></label></div>
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setAlertModal(false)}>Cancel</button><button type="submit" className="button button-primary"><Check />{editingAlert ? 'Save changes' : 'Create alert'}</button></div>
    </form></div>}
    {toast && <div className="toast" role="status"><Check />{toast}<button aria-label="Dismiss message" onClick={() => setToast('')}><X /></button></div>}
  </div>
}
