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
    <section style={{ marginTop: 24 }}>
      <h3>Manage Menu</h3>
      {trucks.length === 0 ? (
        <p>No trucks assigned to you yet.</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label>
              Truck:
              <select value={selected} onChange={e => setSelected(e.target.value)} style={{ marginLeft: 6 }}>
                {trucks.map(t => (
                  <option key={t._id || t.id} value={t._id || t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selected && <MenuManager truckId={selected} />}
        </>
      )}
    </section>
  );
}
