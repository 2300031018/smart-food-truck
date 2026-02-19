import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { managerApi } from '../../api/client';
import { formatCurrency } from '../../utils/currency';

const STAR_COLORS = { high: '#f59e0b', low: '#94a3b8' };

function StatCard({ icon, label, value, color = '#6366f1' }) {
    return (
        <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 3px rgb(0 0 0 / 0.08)', flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
        </div>
    );
}

function StopCard({ stop, isTop }) {
    const peakHour = Object.entries(stop.peakHours || {}).sort((a, b) => b[1] - a[1])[0];
    const topItem = Object.entries(stop.popularItems || {}).sort((a, b) => b[1] - a[1])[0];

    return (
        <div style={{
            background: isTop ? 'linear-gradient(135deg, #fdf4ff, #ede9fe)' : '#f8fafc',
            border: `1px solid ${isTop ? '#c4b5fd' : '#e2e8f0'}`,
            borderRadius: 10, padding: 16, position: 'relative'
        }}>
            {isTop && (
                <span style={{ position: 'absolute', top: 10, right: 12, background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                    ⭐ TOP STOP
                </span>
            )}
            <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: 15 }}>{stop.stopName || stop.stopId}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div style={{ color: '#64748b' }}>Revenue</div>
                <div style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(stop.totalRevenue || 0)}</div>
                <div style={{ color: '#64748b' }}>Orders</div>
                <div style={{ fontWeight: 600 }}>{stop.orderCount}</div>
                <div style={{ color: '#64748b' }}>Avg. Order</div>
                <div style={{ fontWeight: 600 }}>{formatCurrency(stop.avgOrderValue || 0)}</div>
                {peakHour && (
                    <>
                        <div style={{ color: '#64748b' }}>Peak Hour</div>
                        <div style={{ fontWeight: 600 }}>🕐 {peakHour[0]}:00</div>
                    </>
                )}
                {topItem && (
                    <>
                        <div style={{ color: '#64748b' }}>Top Item</div>
                        <div style={{ fontWeight: 600 }}>🍴 {topItem[0]}</div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function ForecastPanel({ trucks = [] }) {
    const { token } = useAuth();
    const [selectedTruck, setSelectedTruck] = useState('');
    const [forecast, setForecast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Auto-select first truck
    useEffect(() => {
        if (trucks.length && !selectedTruck) {
            setSelectedTruck(trucks[0]._id || trucks[0].id);
        }
    }, [trucks]);

    useEffect(() => {
        if (!selectedTruck || !token) return;
        setLoading(true);
        setError(null);
        managerApi.getForecast(token, selectedTruck)
            .then(res => { if (res.success) setForecast(res.data); })
            .catch(err => setError(err.message || 'Failed to load forecast'))
            .finally(() => setLoading(false));
    }, [selectedTruck, token]);

    const topStopId = forecast?.summary?.topStop?.stopId;

    return (
        <div style={{ fontFamily: 'system-ui' }}>
            {/* Header + Truck selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 18, color: '#1e293b' }}>📊 Sales Forecast</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>Historical performance per stop</p>
                </div>
                {trucks.length > 1 && (
                    <select
                        value={selectedTruck}
                        onChange={e => setSelectedTruck(e.target.value)}
                        style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', cursor: 'pointer' }}
                    >
                        {trucks.map(t => (
                            <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: '#6366f1' }}>⏳ Loading forecast data...</div>
            )}

            {error && (
                <div style={{ padding: 16, background: '#fff1f2', border: '1px solid #fda4af', borderRadius: 8, color: '#be123c' }}>
                    ⚠️ {error}
                </div>
            )}

            {forecast && !loading && (
                <>
                    {/* Summary KPIs */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                        <StatCard icon="💰" label="Total Revenue" value={formatCurrency(forecast.summary?.totalHistoricalRevenue || 0)} color="#10b981" />
                        <StatCard icon="📦" label="Total Orders" value={forecast.summary?.totalHistoricalOrders || 0} color="#6366f1" />
                        <StatCard icon="🏆" label="Top Stop" value={forecast.summary?.topStop?.stopName || '—'} color="#f59e0b" />
                    </div>

                    {/* AI recommendations */}
                    {(forecast.summary?.recommendations || []).length > 0 && (
                        <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                            <h4 style={{ margin: '0 0 10px', color: '#15803d', fontSize: 14 }}>🤖 AI Recommendations</h4>
                            {forecast.summary.recommendations.map((rec, i) => (
                                <div key={i} style={{ fontSize: 13, color: '#14532d', padding: '6px 0', borderBottom: i < forecast.summary.recommendations.length - 1 ? '1px solid #bbf7d0' : 'none' }}>
                                    • {rec}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* No data state */}
                    {(!forecast.forecasts || forecast.forecasts.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: 12, color: '#94a3b8' }}>
                            <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                            <p style={{ margin: 0 }}>No order history yet for this truck. Forecast data will appear after orders are completed.</p>
                        </div>
                    )}

                    {/* Per-stop cards */}
                    {forecast.forecasts && forecast.forecasts.length > 0 && (
                        <>
                            <h4 style={{ color: '#1e293b', fontSize: 14, margin: '0 0 12px' }}>Performance by Stop</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                                {forecast.forecasts.map(stop => (
                                    <StopCard key={stop.stopId} stop={stop} isTop={stop.stopId === topStopId} />
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
