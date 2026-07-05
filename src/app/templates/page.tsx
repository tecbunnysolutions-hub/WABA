"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Template = {
  id: string;
  name: string;
  language: string;
  content: string;
  status: string;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // New Template Form
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newLang, setNewLang] = useState("en");

  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(res => res.json()).then(data => {
      if (!data.user) router.push('/login');
      else fetchTemplates();
    });
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newContent) return;
    
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, content: newContent, language: newLang })
      });
      if (res.ok) {
        setNewName("");
        setNewContent("");
        setIsCreating(false);
        fetchTemplates();
      } else {
        alert("Failed to create template.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Template Library</h1>
          <p style={{ color: '#94a3b8' }}>Manage approved WhatsApp Message Templates</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => router.push('/')} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>← Back to Inbox</button>
          <button onClick={() => setIsCreating(!isCreating)} style={{ background: '#10b981', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ New Template</button>
        </div>
      </div>

      {isCreating && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Create New Template</h2>
          <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
            <div className="crm-field">
              <label>Template Name (e.g. welcome_message)</label>
              <input type="text" className="crm-input" value={newName} onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '_'))} required />
            </div>
            <div className="crm-field">
              <label>Language Code</label>
              <select className="crm-select" value={newLang} onChange={e => setNewLang(e.target.value)}>
                <option value="en">English (en)</option>
                <option value="es">Spanish (es)</option>
                <option value="pt">Portuguese (pt)</option>
              </select>
            </div>
            <div className="crm-field">
              <label>Message Content (Use {"{{1}}"} for variables)</label>
              <textarea className="crm-textarea" value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Hi {{1}}, your order {{2}} has shipped!" required />
            </div>
            <button type="submit" style={{ background: '#3b82f6', color: 'white', padding: '1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Submit for Approval</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="spinner"></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {templates.map(t => (
            <div key={t.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{t.name}</h3>
                <span className={`crm-status-badge status-WON`} style={{ margin: 0 }}>{t.status}</span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>Language: {t.language}</p>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem', lineHeight: 1.5, minHeight: '100px' }}>
                {t.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
