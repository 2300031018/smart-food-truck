import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ReservationCreate(){
  const { token } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [truckId, setTruckId] = useState('');
  const [date, setDate] = useState('');
  const [slotStart, setSlotStart] = useState('12:00');
  const [slotEnd, setSlotEnd] = useState('13:00');
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    api.getTrucks().then(r => { if(r.success) setTrucks(r.data); });
  }, []);

  async function submit(e){
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);
    try {
      const payload = { truck: truckId, date, slotStart, slotEnd, partySize: Number(partySize), notes };
      const res = await api.createReservation(token, payload);
      if (res.success){
        setSuccess(res.data._id);
        setNotes('');
      }
    } catch (e){ setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Create Reservation</h2>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:400 }}>
        <select value={truckId} onChange={e=> setTruckId(e.target.value)} required>
          <option value="">Select Truck</option>
            {trucks.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        <input type="date" value={date} onChange={e=> setDate(e.target.value)} required />
        <div style={{ display:'flex', gap:8 }}>
          <input type="time" value={slotStart} onChange={e=> setSlotStart(e.target.value)} required />
          <input type="time" value={slotEnd} onChange={e=> setSlotEnd(e.target.value)} required />
        </div>
        <input type="number" min={1} value={partySize} onChange={e=> setPartySize(e.target.value)} required />
        <textarea placeholder="Notes" value={notes} onChange={e=> setNotes(e.target.value)} />
        <button disabled={loading}>{loading ? 'Submitting...' : 'Create Reservation'}</button>
        {error && <div style={{ color:'red' }}>{error}</div>}
        {success && <div style={{ color:'green' }}>Reservation created: {success}</div>}
      </form>
    </div>
  );
}