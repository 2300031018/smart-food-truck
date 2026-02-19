import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';

// Dashboard layout constants

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

        // Use a single call to the combined analytics endpoint
        api.getAnalyticsSummary(token, params).then(res => {
            if (!mounted) return;
            if (res.success) {
                setSummary(res.data.summary || {});
                setTrend(res.data.charts?.salesTrend || null);
                setTopItems(res.data.charts?.topItems || null);
                setPeakHours(res.data.charts?.peakHours || null);
                setError(null);
            }
        }).catch(err => {
            if (mounted) setError(err.message || 'Failed to load analytics');
        }).finally(() => {
            if (mounted) setLoading(false);
        });

        return () => { mounted = false; };
    }, [token, days, selectedTruck]);

    if (loading && !trend) return <div style={{ padding: 20 }}>Gathering data science insights...</div>;
    if (error) return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;

    return (
        <div style={{ padding: '24px', fontFamily: 'system-ui', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>
                    Analytics & Visualization <span style={{ fontSize: 13, fontWeight: 400, color: '#6366f1' }}>(Powered by Python)</span>
                </h2>

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
                    {trend ? (
                        <img src={`data:image/png;base64,${trend}`} alt="Sales Trend" style={{ width: '100%', borderRadius: 8 }} />
                    ) : <div style={emptyChart}>No trend data available</div>}
                </div>

                {/* Top Items */}
                <div style={chartContainer}>
                    <h4 style={chartTitle}>Top 5 Items (Revenue)</h4>
                    {topItems ? (
                        <img src={`data:image/png;base64,${topItems}`} alt="Top Items" style={{ width: '100%', borderRadius: 8 }} />
                    ) : <div style={emptyChart}>No item data available</div>}
                </div>

                {/* Peak Hours */}
                <div style={chartContainer}>
                    <h4 style={chartTitle}>Peak Ordering Hours</h4>
                    {peakHours ? (
                        <img src={`data:image/png;base64,${peakHours}`} alt="Peak Hours" style={{ width: '100%', borderRadius: 8 }} />
                    ) : <div style={emptyChart}>No activity data available</div>}
                </div>
            </div>
        </div>
    );
}

const emptyChart = { height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#f1f5f9', borderRadius: 8, fontSize: 13 };

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
