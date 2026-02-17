import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function RouteEditorModal({ truck, token, onClose, onSave }) {
    const [routePlan, setRoutePlan] = useState({
        name: '',
        dailyStart: '09:00',
        dailyEnd: '11:00',
        stops: []
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (truck && truck.routePlan) {
            setRoutePlan({
                name: truck.routePlan.name || '',
                dailyStart: truck.routePlan.dailyStart || '09:00',
                dailyEnd: truck.routePlan.dailyEnd || '11:00',
                stops: Array.isArray(truck.routePlan.stops) ? truck.routePlan.stops.map(s => ({
                    ...s,
                    stayMin: s.stayMin !== undefined ? s.stayMin : (s.waitTime !== undefined ? s.waitTime : 15)
                })) : []
            });
        }
    }, [truck]);

    function handleStopChange(index, field, value) {
        const newStops = [...routePlan.stops];
        newStops[index] = { ...newStops[index], [field]: value };
        setRoutePlan({ ...routePlan, stops: newStops });
    }

    function addStop() {
        setRoutePlan(prev => ({
            ...prev,
            stops: [...prev.stops, { name: 'New Stop', lat: 16.5, lng: 80.6, stayMin: 15 }]
        }));
    }

    function removeStop(index) {
        setRoutePlan(prev => ({
            ...prev,
            stops: prev.stops.filter((_, i) => i !== index)
        }));
    }

    function moveStop(index, direction) {
        const newStops = [...routePlan.stops];
        if (direction === -1 && index > 0) {
            [newStops[index], newStops[index - 1]] = [newStops[index - 1], newStops[index]];
        } else if (direction === 1 && index < newStops.length - 1) {
            [newStops[index], newStops[index + 1]] = [newStops[index + 1], newStops[index]];
        }
        setRoutePlan({ ...routePlan, stops: newStops });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (routePlan.stops.length < 2) {
            setError('Route must have at least 2 stops');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await api.updateTruckRoutePlan(token, truck.id || truck._id, routePlan);
            if (res.success) {
                onSave();
                onClose();
            }
        } catch (err) {
            setError(err.message || 'Failed to save route');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <h3>Edit Route: {truck.name}</h3>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div style={rowStyle}>
                        <label>Route Name: <input value={routePlan.name} onChange={e => setRoutePlan({ ...routePlan, name: e.target.value })} /></label>
                    </div>
                    <div style={rowStyle}>
                        <label>Start: <input type="time" value={routePlan.dailyStart} onChange={e => setRoutePlan({ ...routePlan, dailyStart: e.target.value })} /></label>
                        <label style={{ marginLeft: 10 }}>End: <input type="time" value={routePlan.dailyEnd} onChange={e => setRoutePlan({ ...routePlan, dailyEnd: e.target.value })} /></label>
                    </div>

                    <h4 style={{ marginTop: 15, marginBottom: 5 }}>Stops</h4>
                    <div style={stopsContainerStyle}>
                        {routePlan.stops.map((stop, i) => (
                            <div key={i} style={stopStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <strong>#{i + 1}</strong>
                                    <div>
                                        <button type="button" onClick={() => moveStop(i, -1)} disabled={i === 0}>↑</button>
                                        <button type="button" onClick={() => moveStop(i, 1)} disabled={i === routePlan.stops.length - 1}>↓</button>
                                        <button type="button" onClick={() => removeStop(i)} style={{ marginLeft: 5, color: 'red' }}>×</button>
                                    </div>
                                </div>
                                <input
                                    placeholder="Stop Name"
                                    value={stop.name}
                                    onChange={e => handleStopChange(i, 'name', e.target.value)}
                                    style={{ width: '100%', marginBottom: 5 }}
                                />
                                <div style={{ display: 'flex', gap: 5 }}>
                                    <input
                                        type="number" step="any" placeholder="Lat"
                                        value={stop.lat}
                                        onChange={e => handleStopChange(i, 'lat', e.target.value)}
                                        style={{ width: '33%' }}
                                    />
                                    <input
                                        type="number" step="any" placeholder="Lng"
                                        value={stop.lng}
                                        onChange={e => handleStopChange(i, 'lng', e.target.value)}
                                        style={{ width: '33%' }}
                                    />
                                    <input
                                        type="number" step="any" placeholder="Stay(m)"
                                        value={stop.stayMin}
                                        onChange={e => handleStopChange(i, 'stayMin', e.target.value)}
                                        style={{ width: '33%' }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addStop} style={{ marginTop: 5, width: '100%' }}>+ Add Stop</button>

                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button type="button" onClick={onClose}>Cancel</button>
                        <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Route'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};
const modalStyle = {
    background: 'white', padding: 20, borderRadius: 8, width: 500, maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto'
};
const rowStyle = { marginBottom: 10 };
const stopsContainerStyle = { maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', padding: 5 };
const stopStyle = { background: '#f9f9f9', border: '1px solid #ddd', padding: 10, marginBottom: 5, borderRadius: 4 };
