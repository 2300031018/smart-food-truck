import React, { useEffect, useRef, useState } from 'react';
import { chatApi } from '../api/chat';
import { useAuth } from '../context/AuthContext';

export default function ChatDrawer({ roomResolver, title='Chat', open, onClose }){
  const { token, user } = useAuth();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const scrollerRef = useRef(null);

  useEffect(() => {
    async function init(){
      if (!open) return;
      setLoading(true); setError(null);
      try {
        const r = await roomResolver(token);
  if (r?.success) setRoom(r.data); else setRoom(r);
  const roomId = r?.data ? (r.data.id || r.data._id) : (r.id || r._id);
        const msgs = await chatApi.listMessages(token, roomId);
        setMessages(msgs.data || msgs);
        // start polling every 3s
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async ()=>{
          try {
            const resp = await chatApi.listMessages(token, roomId);
            setMessages(resp.data || resp);
          } catch {}
        }, 3000);
      } catch(e){ setError(e.message); } finally { setLoading(false); }
    }
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open, token, roomResolver]);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, open]);

  async function send(){
    if (!input.trim() || !room) return;
    try {
      const roomId = room.id || room._id;
      const resp = await chatApi.postMessage(token, roomId, input.trim());
      const msg = (resp.data || resp);
      setMessages(m => [...m, msg]);
      setInput('');
    } catch(e){ alert(e.message); }
  }

  if (!open) return null;
  return (
    <div style={{ position:'fixed', right:0, top:0, bottom:0, width:360, background:'#fff', borderLeft:'1px solid #ddd', boxShadow:'-8px 0 20px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', zIndex:9999 }}>
      <div style={{ padding:'10px 12px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <strong>{title}</strong>
        <button onClick={onClose} style={{ cursor:'pointer' }}>✕</button>
      </div>
      {loading ? (
        <div style={{ padding:12 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding:12, color:'#b00020' }}>Error: {error}</div>
      ) : (
        <>
          <div ref={scrollerRef} style={{ flex:1, overflowY:'auto', padding:12, fontSize:14 }}>
            {messages.map(m => (
              <div key={m._id || m.id} style={{ marginBottom:8, display:'flex', flexDirection:'column', alignItems: (m.sender===user?.id ? 'flex-end':'flex-start') }}>
                <div style={{ background: (m.sender===user?.id ? '#e7f5ff':'#f5f5f5'), padding:'6px 8px', borderRadius:6, maxWidth:260 }}>
                  <div style={{ whiteSpace:'pre-wrap' }}>{m.text}</div>
                </div>
                <div style={{ fontSize:10, opacity:.6, marginTop:2 }}>{new Date(m.createdAt).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:10, borderTop:'1px solid #eee', display:'flex', gap:6 }}>
            <input value={input} onChange={e=> setInput(e.target.value)} onKeyDown={e=> { if(e.key==='Enter') send(); }} placeholder="Type a message" style={{ flex:1 }} />
            <button onClick={send}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}
