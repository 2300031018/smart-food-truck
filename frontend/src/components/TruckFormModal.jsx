import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function TruckFormModal({ truck, token, onClose, onSave, onSuccess }) {
    const [step, setStep] = useState(1); // 1: Details, 2: Route
    const [form, setForm] = useState({
        name: '',
        description: '',
        cuisineType: '',
        status: 'SERVING'
    });
    const [routePlan, setRoutePlan] = useState({
        name: 'Daily Schedule',
        dailyStart: '09:00',
        dailyEnd: '11:00',
        stops: [
            { name: 'Start Location', lat: 16.5, lng: 80.6, waitTime: 60 },
            { name: 'End Location', lat: 16.51, lng: 80.61, waitTime: 60 }
        ]
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Initial state based on truck prop (edit mode)
    useEffect(() => {
        if (truck && (truck.id || truck._id)) {
            setForm({
                name: truck.name || '',
                description: truck.description || '',
                cuisineType: truck.cuisineType || '',
                status: truck.status || 'SERVING'
            });
            if (truck.routePlan) {
                setRoutePlan(truck.routePlan);
            }
        }
    }, [truck]);

    function handleStopChange(index, field, value) {
        const newStops = [...routePlan.stops];
        newStops[index] = { ...newStops[index], [field]: value };
        setRoutePlan({ ...routePlan, stops: newStops });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);

        if (step === 1 && !truck) {
            setStep(2);
            return;
        }

        setLoading(true);
        try {
            let res;
            if (truck && (truck.id || truck._id)) {
                // UPDATE (Details only - Route handled by separate modal usually, 
                // but we update it here too if needed/available)
                res = await api.updateTruck(token, truck.id || truck._id, form);
            } else {
                // CREATE (Full object with route)
                const payload = {
                    ...form,
                    routePlan,
                    currentStopIndex: 0
                };
                res = await api.createTruck(token, payload);
            }

            if (res.success) {
                if (onSuccess) onSuccess(res.data);
                if (onSave) onSave();
                onClose();
            }
        } catch (err) {
            setError(err.message || 'Failed to save truck');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={overlayStyle}>
            <div style={{ ...modalStyle, width: step === 2 ? 550 : 400 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0 }}>{truck ? 'Edit Truck' : `Create Truck (Step ${step}/2)`}</h3>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <div style={{ width: 30, height: 6, borderRadius: 3, background: '#2563eb' }}></div>
                        <div style={{ width: 30, height: 6, borderRadius: 3, background: step >= 2 || truck ? '#2563eb' : '#e2e8f0' }}></div>
                    </div>
                </div>

                {error && <p style={{ color: '#ef4444', fontSize: 13, background: '#fee2e2', padding: 8, borderRadius: 4 }}>{error}</p>}

                <form onSubmit={handleSubmit}>
                    {step === 1 ? (
                        <>
                            <div style={rowStyle}>
                                <label style={labelStyle}>Truck Name:</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    required
                                    style={inputStyle}
                                    placeholder="e.g. Taco Time"
                                />
                            </div>
                            <div style={rowStyle}>
                                <label style={labelStyle}>Description:</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    style={{ ...inputStyle, height: 80 }}
                                    placeholder="What makes your truck unique?"
                                />
                            </div>
                            <div style={rowStyle}>
                                <label style={labelStyle}>Cuisine Type:</label>
                                <input
                                    value={form.cuisineType}
                                    onChange={e => setForm({ ...form, cuisineType: e.target.value })}
                                    placeholder="e.g. Mexican, Indian"
                                    style={inputStyle}
                                />
                            </div>
                            {truck && (
                                <div style={rowStyle}>
                                    <label style={labelStyle}>Status:</label>
                                    <select
                                        value={form.status}
                                        onChange={e => setForm({ ...form, status: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="OPEN">OPEN</option>
                                        <option value="SERVING">SERVING</option>
                                        <option value="MOVING">MOVING</option>
                                        <option value="CLOSED">CLOSED</option>
                                    </select>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
                            <div style={rowStyle}>
                                <label style={labelStyle}>Route Name:</label>
                                <input
                                    value={routePlan.name}
                                    onChange={e => setRoutePlan({ ...routePlan, name: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Daily Start:</label>
                                    <input type="time" value={routePlan.dailyStart} onChange={e => setRoutePlan({ ...routePlan, dailyStart: e.target.value })} style={inputStyle} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Daily End:</label>
                                    <input type="time" value={routePlan.dailyEnd} onChange={e => setRoutePlan({ ...routePlan, dailyEnd: e.target.value })} style={inputStyle} />
                                </div>
                            </div>
                            <h4 style={{ margin: '15px 0 10px 0', fontSize: 14 }}>Stops</h4>
                            {routePlan.stops.map((stop, i) => (
                                <div key={i} style={stopCardStyle}>
                                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Stop #{i + 1}</div>
                                    <input placeholder="Stop Name" value={stop.name} onChange={e => handleStopChange(i, 'name', e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <input type="number" step="any" placeholder="Lat" value={stop.lat} onChange={e => handleStopChange(i, 'lat', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                                        <input type="number" step="any" placeholder="Lng" value={stop.lng} onChange={e => handleStopChange(i, 'lng', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                                        <input type="number" placeholder="Wait(min)" value={stop.waitTime} onChange={e => handleStopChange(i, 'waitTime', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setRoutePlan(prev => ({ ...prev, stops: [...prev.stops, { name: '', lat: 16.5, lng: 80.6, waitTime: 60 }] }))}
                                style={{ width: '100%', padding: 10, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 6, cursor: 'pointer', marginBottom: 10 }}>
                                + Add Another Stop
                            </button>
                        </div>
                    )}

                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        {step === 2 && !truck && (
                            <button type="button" onClick={() => setStep(1)} style={btnSecondary}>Back</button>
                        )}
                        <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
                        <button type="submit" disabled={loading} style={btnPrimary}>
                            {loading ? 'Saving...' : (truck ? 'Update Details' : (step === 1 ? 'Next: Define Route' : 'Create Truck & Route'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    backdropFilter: 'blur(4px)'
};
const modalStyle = {
    background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
};
const rowStyle = { marginBottom: 16 };
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#475569' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' };
const btnPrimary = { background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' };
const btnSecondary = { background: 'white', color: '#475569', padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 600 };
const stopCardStyle = { background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 };
