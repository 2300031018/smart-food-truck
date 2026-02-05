import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function onChange(e){
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function submit(e){
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.signup(form);
      if (res.success) {
        login(res.data.token, res.data.user);
        navigate('/trucks');
      } else {
        setError('Signup failed');
      }
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth:360, margin:'60px auto', fontFamily:'system-ui' }}>
      <h2>Sign Up</h2>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <input name="name" placeholder="Name" value={form.name} onChange={onChange} required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={onChange} required />
        <input name="password" type="password" placeholder="Password" value={form.password} onChange={onChange} required />
        <button disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</button>
        {error && <div style={{ color:'red' }}>{error}</div>}
        <div style={{ fontSize:12 }}>Already have an account? <a href="/login">Login</a></div>
      </form>
    </div>
  );
}