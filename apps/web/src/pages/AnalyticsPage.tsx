import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { analyticsApi } from '../api/endpoints'

export default function AnalyticsPage() {
  const { data: revenue } = useQuery({ queryKey: ['analytics', 'revenue'], queryFn: analyticsApi.revenue })
  const { data: channels } = useQuery({ queryKey: ['analytics', 'channels'], queryFn: analyticsApi.channels })
  const { data: team } = useQuery({ queryKey: ['analytics', 'team'], queryFn: analyticsApi.team })

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="sticky top-0 z-10 bg-[var(--tg-secondary)]/80 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[var(--tg-border)]">
        <h1 className="text-2xl font-bold text-[var(--tg-text)]">Analytics</h1>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Top Advertisers */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--tg-text)] mb-3">Top Advertisers by Revenue</h2>
          <div className="card p-4 h-64">
            {revenue && revenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="advertiser" type="category" axisLine={false} tickLine={false} fontSize={10} width={80} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', background: 'var(--tg-bg)', color: 'var(--tg-text)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="revenue" fill="var(--tg-button)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[var(--tg-hint)]">No revenue data yet</div>
            )}
          </div>
        </section>

        {/* Channel Performance */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--tg-text)] mb-3">Channel Performance</h2>
          <div className="space-y-3">
            {channels?.map(c => (
              <div key={c.id} className="card p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm">{c.name}</span>
                  <span className="text-xs font-bold text-green-600">{c.currency} {Number(c.totalRevenue).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--tg-hint)]">
                  <span>{c.totalAds} Ads Total</span>
                  <span>{(c.subscriberCount / 1000).toFixed(1)}k Subs</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Team Productivity */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--tg-text)] mb-3">Team Productivity (This Month)</h2>
          <div className="space-y-3">
            {team?.map(m => (
              <div key={m.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--tg-secondary)] flex items-center justify-center text-xs font-bold shrink-0">
                    {m.name[0]}
                  </div>
                  <div>
                    <span className="font-medium text-sm block">{m.name}</span>
                    <span className="text-[10px] text-[var(--tg-hint)]">{m.role}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold block">{m.postedThisMonth}</span>
                  <span className="text-[10px] text-[var(--tg-hint)]">Ads Posted</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
