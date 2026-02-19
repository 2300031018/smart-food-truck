import React, { useEffect, useState } from 'react';
import { managerApi } from '../api/client';
import { formatCurrency } from '../utils/currency';

export default function SmartInsights({ truckId, token, onboardClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;
        managerApi.getForecast(token, truckId)
            .then(res => {
                if (mounted && res.success) setData(res.data);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
        return () => { mounted = false; };
    }, [truckId, token]);

    if (loading) return <div style={{ padding: 10 }}>Analyzing historical data...</div>;
    if (error) return <div style={{ padding: 10, color: '#dc2626' }}>Forecast Error: {error}</div>;
    if (!data || !data.forecasts || data.forecasts.length === 0) {
        return (
            <div style={containerStyle}>
                <h4>Smart Insights</h4>
                <p style={{ fontSize: 13, color: '#64748b' }}>Not enough historical data to generate a forecast yet. Keep serving customers to unlock insights!</p>
                <button onClick={onboardClose} className="btn" style={{ padding: '4px 10px' }}>Close</button>
            </div>
        );
    }

    const { summary, forecasts } = data;

    return (
        <div style={containerStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>Smart Insights · {summary.totalHistoricalOrders} Orders</h4>
                <button onClick={onboardClose} style={closeBtn}>&times;</button>
            </div>

            <div style={cardGrid}>
                <div style={miniCard}>
                    <div style={label}>Total Revenue</div>
                    <div style={value}>{formatCurrency(summary.totalHistoricalRevenue)}</div>
                </div>
                <div style={miniCard}>
                    <div style={label}>Top Performing Stop</div>
                    <div style={value}>{summary.topStop?.stopName || 'None'}</div>
                </div>
            </div>

            <div style={recSection}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>💡</span> AI Recommendations
                </div>
                {summary.recommendations.map((rec, i) => (
                    <div key={i} style={recItem}>{rec}</div>
                ))}
            </div>

            <div style={{ marginTop: 15 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Revenue Breakdown per Stop</div>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                            <tr>
                                <th style={thStyle}>Stop Name</th>
                                <th style={thStyle}>Orders</th>
                                <th style={thStyle}>Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {forecasts.map((f, i) => (
                                <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                                    <td style={tdStyle}>{f.stopName}</td>
                                    <td style={tdStyle}>{f.orderCount}</td>
                                    <td style={tdStyle}>{formatCurrency(f.totalRevenue)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const containerStyle = { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 15, marginTop: 10, position: 'relative' };
const cardGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 15 };
const miniCard = { background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e0f2fe' };
const label = { fontSize: 11, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 };
const value = { fontSize: 14, fontWeight: 700, color: '#0c4a6e', marginTop: 2 };
const recSection = { background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e0f2fe' };
const recItem = { fontSize: 13, color: '#075985', marginBottom: 4, paddingLeft: 12, position: 'relative' };
const closeBtn = { background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#0369a1', lineHeight: 0.5 };
const thStyle = { textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 };
const tdStyle = { padding: '6px 8px', color: '#334155' };
