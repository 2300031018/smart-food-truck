import React, { useEffect, useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];

export default function AnalyticsDashboard() {
    const { token, user } = useAuth();
    const [summary, setSummary] = useState({ totalRevenue: 0, orderCount: 0, avgOrderValue: 0 });
    const [trend, setTrend] = useState([]);
    const [topItems, setTopItems] = useState([]);
    const [peakHours, setPeakHours] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [days, setDays] = useState(30);
    const [selectedTruck, setSelectedTruck] = useState('');
    const [trucks, setTrucks] = useState([]);

    useEffect(() => {
        if (user?.role === 'admin') {
            api.getTrucks().then(res => {
                if (res.success) setTrucks(res.data);
            });
        }
    }, [user]);

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const params = { days };
        if (selectedTruck) params.truckId = selectedTruck;

        Promise.all([
            api.getAnalyticsSummary(token, params),
            api.getSalesTrend(token, params),
            api.getTopItems(token, params),
            api.getPeakHours(token, params)
        ]).then(([sumRes, trendRes, topRes, peakRes]) => {
            if (!mounted) return;
            if (sumRes.success) setSummary(sumRes.data);
            if (trendRes.success) setTrend(trendRes.data);
            if (topRes.success) setTopItems(topRes.data);
            if (peakRes.success) setPeakHours(peakRes.data);
            setError(null);
        }).catch(err => {
            if (mounted) setError(err.message || 'Failed to load analytics');
        }).finally(() => {
            if (mounted) setLoading(false);
        });

        return () => { mounted = false; };
    }, [token, days, selectedTruck]);

    if (loading && trend.length === 0) return <div style={{ padding: 20 }}>Gathering insights...</div>;
    if (error) return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;

    return (
        <div style={{ padding: '24px', fontFamily: 'system-ui', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>Analytics Dashboard</h2>

                <div style={{ display: 'flex', gap: 12 }}>
                    {user?.role === 'admin' && (
                        <select
                            value={selectedTruck}
                            onChange={e => setSelectedTruck(e.target.value)}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                            <option value="">All Trucks</option>
                            {trucks.map(t => (
                                <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                            ))}
                        </select>
                    )}
                    <select
                        value={days}
                        onChange={e => setDays(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    >
                        <option value={7}>Last 7 Days</option>
                        <option value={30}>Last 30 Days</option>
                        <option value={90}>Last 90 Days</option>
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 24 }}>
                <Card title="Total Revenue" value={formatCurrency(summary.totalRevenue)} color="#6366f1" />
                <Card title="Total Orders" value={summary.orderCount} color="#10b981" />
                <Card title="Avg. Order Value" value={formatCurrency(summary.avgOrderValue)} color="#f59e0b" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                {/* Revenue Trend */}
                <div style={chartContainer}>
                    <h4 style={chartTitle}>Revenue Trend</h4>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="_id" stroke="#64748b" fontSize={12} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `$${val}`} />
                                <Tooltip
                                    formatter={(value) => [formatCurrency(value), 'Revenue']}
                                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Items */}
                <div style={chartContainer}>
                    <h4 style={chartTitle}>Top 5 Items (Revenue)</h4>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topItems.slice(0, 5)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="_id" type="category" stroke="#64748b" fontSize={12} width={100} />
                                <Tooltip
                                    formatter={(value) => [formatCurrency(value), 'Revenue']}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                                    {topItems.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Peak Hours */}
                <div style={chartContainer}>
                    <h4 style={chartTitle}>Peak Ordering Hours</h4>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={peakHours}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="_id" stroke="#64748b" fontSize={12} tickFormatter={(h) => `${h}:00`} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip labelFormatter={(h) => `${h}:00`} name="Orders" />
                                <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution of Sales */}
                <div style={chartContainer}>
                    <h4 style={chartTitle}>Revenue Share by Item</h4>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={topItems.slice(0, 8)}
                                    dataKey="revenue"
                                    nameKey="_id"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {topItems.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Card({ title, value, color }) {
    return (
        <div style={{ background: '#fff', padding: '20px', borderRadius: 12, boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', borderLeft: `4px solid ${color}` }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>{value}</div>
        </div>
    );
}

const chartContainer = {
    background: '#fff',
    padding: '20px',
    borderRadius: 12,
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
    border: '1px solid #e2e8f0'
};

const chartTitle = {
    margin: '0 0 20px 0',
    color: '#475569',
    fontSize: 15,
    fontWeight: 600
};
