import React, { useEffect, useState } from 'react';
import MenuManager from '../menu/MenuManager';

export default function ManagerMenuPanel({ trucks = [] }) {
  const [selected, setSelected] = useState('');

  // Sync selected truck when trucks list changes
  useEffect(() => {
    if (trucks.length > 0) {
      // If none selected, or selected truck no longer exists, pick the first one
      const stillExists = trucks.find(t => (t._id || t.id) === selected);
      if (!selected || !stillExists) {
        setSelected(trucks[0]._id || trucks[0].id);
      }
    } else {
      setSelected('');
    }
  }, [trucks, selected]);

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h3>Manage Menu</h3>
      <p style={{ marginBottom: 20, fontSize: 14, color: 'var(--text-secondary)' }}>Select a truck to manage its available menu items and availability.</p>
      {trucks.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No trucks assigned to you yet.</p>
      ) : (
        <>
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Truck:
            </label>
            <select value={selected} onChange={e => setSelected(e.target.value)} style={{ minWidth: 200 }}>
              {trucks.map(t => (
                <option key={t._id || t.id} value={t._id || t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24 }}>
            {selected && <MenuManager truckId={selected} />}
          </div>
        </>
      )}
    </section>
  );
}
