"use client";

import { useState } from "react";

export default function CampaignsPage() {
  const [targetStatus, setTargetStatus] = useState("ALL");
  const [templateName, setTemplateName] = useState("registration_confirmation");
  const [isSending, setIsSending] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const handleSendCampaign = async () => {
    if (!confirm(`Are you sure you want to blast the '${templateName}' template to all contacts with status '${targetStatus}'?`)) {
      return;
    }

    setIsSending(true);
    setResultMessage("");

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus, templateName })
      });
      const data = await res.json();

      if (data.success) {
        setResultMessage(`✅ Campaign sent successfully to ${data.count} contacts!`);
      } else {
        setResultMessage(`❌ Failed: ${data.error}`);
      }
    } catch (err: any) {
      setResultMessage(`❌ Error: ${err.message}`);
    }

    setIsSending(false);
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Bulk Campaigns</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>Send a WhatsApp Template to a targeted audience.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase' }}>Target Audience</label>
          <select 
            className="crm-select" 
            value={targetStatus} 
            onChange={e => setTargetStatus(e.target.value)}
          >
            <option value="ALL">All Contacts</option>
            <option value="NEW">New</option>
            <option value="LEAD">Leads</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="PROPOSAL">Proposal</option>
            <option value="WON">Won (Customers)</option>
            <option value="LOST">Lost</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase' }}>WhatsApp Template</label>
          <select 
            className="crm-select" 
            value={templateName} 
            onChange={e => setTemplateName(e.target.value)}
          >
            <option value="registration_confirmation">registration_confirmation</option>
            <option value="hello_world">hello_world</option>
          </select>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Note: Only pre-approved templates from Infobip can be sent.</p>
        </div>

        <button 
          onClick={handleSendCampaign}
          disabled={isSending}
          style={{
            padding: '1rem',
            background: isSending ? 'rgba(59, 130, 246, 0.5)' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: isSending ? 'not-allowed' : 'pointer',
            marginTop: '1rem',
            fontSize: '1rem',
            transition: 'background 0.2s'
          }}
        >
          {isSending ? 'Broadcasting...' : '🚀 Blast Campaign'}
        </button>

        {resultMessage && (
          <div style={{ padding: '1rem', borderRadius: '8px', background: resultMessage.startsWith('✅') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: resultMessage.startsWith('✅') ? '#34d399' : '#f87171', border: `1px solid ${resultMessage.startsWith('✅') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
            {resultMessage}
          </div>
        )}
        
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <a href="/" style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to CRM Inbox</a>
        </div>
      </div>
    </div>
  );
}
