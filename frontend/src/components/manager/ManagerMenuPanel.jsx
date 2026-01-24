import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import MenuManager from '../menu/MenuManager';

export default function ManagerMenuPanel(){
  const { token } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    let mounted = true;
    async function load(){
      setLoading(true);
      try {
        const d = await api.getManagedTrucks(token);
        if (mounted && d?.success) {
          setTrucks(d.data || []);
          if (d.data?.length && !selected) setSelected(d.data[0]._id || d.data[0].id);
        }
      } finally { if (mounted) setLoading(false); }
    }
    if (token) load();
    return () => { mounted = false; };
  }, [token]);

  return (
    <section style={{ marginTop:24 }}>
      <h3>Manage Menu</h3>
      {loading ? (
        <p>Loading trucks…</p>
      ) : trucks.length === 0 ? (
        <p>No trucks assigned to you yet.</p>
      ) : (
        <>
          <div style={{ marginBottom:12 }}>
            <label>
              Truck:
              <select value={selected} onChange={e=> setSelected(e.target.value)} style={{ marginLeft:6 }}>
                {trucks.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>
          {selected && <MenuManager truckId={selected} />}
        </>
      )}
    </section>
  );
}
