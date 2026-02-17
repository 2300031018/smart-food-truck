import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function TruckFormModal({ truck, token, onClose, onSave, onSuccess }) {
    const [form, setForm] = useState({
        name: '',
        description: '',
        cuisineType: '',
        status: 'SERVING'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Initial state based on truck prop (edit mode)
    useEffect(() => {
        if (truck) {
            setForm({
                name: truck.name || '',
                description: truck.description || '',
                cuisineType: truck.cuisineType || '',
                status: truck.status || 'SERVING'
            });
        }
    }, [truck]);

    // Handle form submission (Create or Update)
    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            let res;
            if (truck) {
                // UPDATE
                res = await api.updateTruck(token, truck.id || truck._id, form);
            } else {
                // CREATE
                // Important: Ensure we include routePlan to satisfy backend validation
                const ROUTE_STOPS = [
                    { name: 'Benz Circle', lat: 16.4957, lng: 80.6542 },
                    { name: 'Siddhartha College', lat: 16.5047, lng: 80.6478 },
                    { name: 'Governorpet', lat: 16.5183, lng: 80.6315 },
                    { name: 'Bhavani Island', lat: 16.5233, lng: 80.6016 }
                ];
                const defaultRoute = {
                    name: 'Central Vijayawada Route',
                    timezone: 'Asia/Kolkata',
                    dailyStart: '09:00',
                    dailyEnd: '11:00',
                    stops: ROUTE_STOPS.map(s => ({ ...s, waitTime: 120 }))
                };

                const payload = {
                    ...form,
                    currentStopIndex: 0,
                    routePlan: defaultRoute
                };
                res = await api.createTruck(token, payload);
            }

            if (res.success) {
                if (onSuccess) onSuccess(res.data); // Pass new truck data back
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
            <div style={modalStyle}>
                <h3>{truck ? 'Edit Truck Details' : 'Create New Truck'}</h3>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div style={rowStyle}>
                        <label style={{ display: 'block', marginBottom: 5 }}>Name:</label>
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            required
                            style={inputStyle}
                        />
                    </div>
                    <div style={rowStyle}>
                        <label style={{ display: 'block', marginBottom: 5 }}>Description:</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            style={{ ...inputStyle, height: 60 }}
                        />
                    </div>
                    <div style={rowStyle}>
                        <label style={{ display: 'block', marginBottom: 5 }}>Cuisine Type:</label>
                        <input
                            value={form.cuisineType}
                            onChange={e => setForm({ ...form, cuisineType: e.target.value })}
                            placeholder="e.g. Mexican, Indian, Burgers"
                            style={inputStyle}
                        />
                    </div>
                    {truck && (
                        <div style={rowStyle}>
                            <label style={{ display: 'block', marginBottom: 5 }}>Status:</label>
                            <select
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="OPEN">OPEN</option>
                                <option value="CLOSED">CLOSED</option>
                                <option value="SERVING">SERVING</option>
                                <option value="PREPARING">PREPARING</option>
                                <option value="SOLD_OUT">SOLD_OUT</option>
                                <option value="MOVING">MOVING</option>
                            </select>
                        </div>
                    )}

                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
                        <button type="submit" disabled={loading} style={btnPrimary}>
                            {loading ? 'Saving...' : (truck ? 'Update Truck' : 'Create Truck')}
                        </button>
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
    background: 'white', padding: 20, borderRadius: 8, width: 400, maxWidth: '90%'
};
const rowStyle = { marginBottom: 15 };
const inputStyle = { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' };
const btnPrimary = { background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer' };
const btnSecondary = { background: '#f1f5f9', color: '#475569', padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer' };
