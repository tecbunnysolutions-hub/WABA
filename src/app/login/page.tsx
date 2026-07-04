"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });
      if (res.ok) {
        window.location.href = "/";
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleQuickLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@business.com', name: 'Demo Agent' })
      });
      if (res.ok) {
        window.location.href = "/";
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Agent Login</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>Access your WABA CRM Workspace</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="crm-field">
            <label>Agent Name</label>
            <input 
              type="text" 
              className="crm-input" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="e.g. John Smith"
              required
            />
          </div>
          
          <div className="crm-field">
            <label>Email Address</label>
            <input 
              type="email" 
              className="crm-input" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              placeholder="john@business.com"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            style={{
              padding: '1rem',
              background: loading ? 'rgba(59, 130, 246, 0.5)' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '1rem',
              fontSize: '1rem',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Workspace'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>Just want to test the app?</p>
          <button 
            type="button"
            onClick={handleQuickLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
              transition: 'background 0.2s'
            }}
          >
            ⚡ Quick Login as Demo Agent
          </button>
        </div>
      </div>
    </div>
  );
}
