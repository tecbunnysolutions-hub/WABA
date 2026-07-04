"use client";

import { useEffect, useState, useRef } from "react";

type Message = {
  id: string;
  sender_number: string;
  direction: 'INBOUND' | 'OUTBOUND';
  message_content: string;
  timestamp: string;
  status: string;
  media_url?: string;
  media_type?: string;
};

type Conversation = {
  id: number;
  sender_number: string;
  last_interaction_timestamp: string;
  contact_name?: string;
  status: string;
  tags: string[];
  notes?: string;
  ad_source?: string;
  messages?: Message[];
};

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // CRM Panel State
  const [crmName, setCrmName] = useState("");
  const [crmStatus, setCrmStatus] = useState("NEW");
  const [crmNotes, setCrmNotes] = useState("");
  const [isSavingCrm, setIsSavingCrm] = useState(false);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation);
      const interval = setInterval(() => fetchMessages(activeConversation), 3000);
      
      // Load CRM data into state when active conversation changes
      const activeObj = conversations.find(c => c.sender_number === activeConversation);
      if (activeObj) {
        setCrmName(activeObj.contact_name || "");
        setCrmStatus(activeObj.status || "NEW");
        setCrmNotes(activeObj.notes || "");
      }

      return () => clearInterval(interval);
    }
  }, [activeConversation]);

  // Update CRM state if conversations array updates (and we aren't typing)
  // To prevent overwriting user input while they type, we only update if the activeObj differs significantly or we're just relying on initial load.
  // Actually, standard behavior is fine without constant overwrite.

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (sender: string) => {
    try {
      const res = await fetch(`/api/messages?conversation=${sender}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;

    const textToSend = inputText;
    setInputText("");

    const tempMsg: Message = {
      id: Date.now().toString(),
      sender_number: activeConversation,
      direction: 'OUTBOUND',
      message_content: textToSend,
      timestamp: new Date().toISOString(),
      status: 'SENDING'
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: activeConversation, text: textToSend })
      });
      if (res.ok) {
        fetchMessages(activeConversation);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveCrmData = async () => {
    if (!activeConversation) return;
    setIsSavingCrm(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_number: activeConversation,
          contact_name: crmName,
          status: crmStatus,
          notes: crmNotes
        })
      });
      if (res.ok) {
        fetchConversations(); // Refresh list to show new names/statuses
      }
    } catch (err) {
      console.error(err);
    }
    setIsSavingCrm(false);
  };

  const activeConvObj = conversations.find(c => c.sender_number === activeConversation);
  const displayName = activeConvObj?.contact_name || activeConversation;

  return (
    <div className="dashboard-container">
      {/* PANE 1: Sidebar / Conversation List */}
      <div className="glass-panel sidebar">
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>CRM Inbox</h2>
          <a href="/campaigns" style={{ fontSize: '0.85rem', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59, 130, 246, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>
            🚀 Campaigns
          </a>
        </div>
        <div className="conversation-list">
          {loading ? (
            <div className="spinner"></div>
          ) : (
            conversations.map(conv => (
              <div 
                key={conv.id} 
                className={`conversation-item ${activeConversation === conv.sender_number ? 'active' : ''}`}
                onClick={() => {
                  setActiveConversation(conv.sender_number);
                  setCrmName(conv.contact_name || "");
                  setCrmStatus(conv.status || "NEW");
                  setCrmNotes(conv.notes || "");
                }}
              >
                <div className="avatar">{(conv.contact_name || conv.sender_number).substring(0, 2).toUpperCase()}</div>
                <div className="conversation-details">
                  <span className="sender">{conv.contact_name || conv.sender_number}</span>
                  <span className="last-msg">
                    {conv.messages?.[0]?.message_content || 'No messages'}
                  </span>
                  {conv.status && (
                    <span className={`crm-status-badge status-${conv.status}`}>
                      {conv.status}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* PANE 2 & 3: Chat Area + CRM Details */}
      <div className="glass-panel chat-area">
        {activeConversation ? (
          <>
            {/* PANE 2: Chat Main */}
            <div className="chat-main">
              <div className="chat-header">
                <h3>{displayName}</h3>
              </div>
              <div className="messages-container">
                {messages.map(msg => {
                  const isLocation = msg.message_content && msg.message_content.startsWith('📍 Location: https://maps.google.com/?q=');
                  let locationCoords = '';
                  let locationAddress = '';
                  let locationUrl = '';
                  
                  if (isLocation) {
                    const parts = msg.message_content.split('?q=');
                    if (parts.length > 1) {
                      const coordsAndAddress = parts[1].split(' ');
                      locationCoords = coordsAndAddress[0];
                      locationAddress = coordsAndAddress.slice(1).join(' ');
                      locationUrl = msg.message_content.replace('📍 Location: ', '').split(' ')[0];
                    }
                  }

                  return (
                  <div key={msg.id} className={`message-wrapper ${msg.direction.toLowerCase()}`}>
                    <div className="message-bubble">
                      {msg.media_url && msg.media_type === 'IMAGE' && (
                        <img src={msg.media_url} alt="Attached image" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }} />
                      )}
                      {msg.media_url && msg.media_type === 'VIDEO' && (
                        <video src={msg.media_url} controls style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }} />
                      )}
                      {msg.media_url && msg.media_type === 'AUDIO' && (
                        <audio src={msg.media_url} controls style={{ maxWidth: '100%', marginBottom: '8px' }} />
                      )}
                      {msg.media_url && msg.media_type === 'DOCUMENT' && (
                        <a href={msg.media_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '8px', color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
                          <span>📄</span> View Document
                        </a>
                      )}
                      
                      {isLocation ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                          <iframe 
                            width="100%" 
                            height="150" 
                            style={{ borderRadius: '8px', border: 0, backgroundColor: '#f0f0f0' }}
                            src={`https://maps.google.com/maps?q=${locationCoords}&z=15&output=embed`} 
                            allowFullScreen 
                            loading="lazy" 
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                          <a href={locationUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#007AFF', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📍</span> Open in Maps {locationAddress}
                          </a>
                        </div>
                      ) : (
                        msg.message_content && msg.message_content !== '[Media]' && <p>{msg.message_content}</p>
                      )}
                      
                      <span className="time">{new Date(msg.timestamp.endsWith('Z') ? msg.timestamp : msg.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form className="message-input-area" onSubmit={handleSendMessage}>
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  autoFocus
                />
                <button type="submit" disabled={!inputText.trim()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </form>
            </div>

            {/* PANE 3: CRM Details Panel */}
            <div className="crm-panel">
              <div className="crm-header">
                <h3>Contact Details</h3>
              </div>
              <div className="crm-body">
                <div className="crm-field">
                  <label>Name</label>
                  <input 
                    type="text" 
                    className="crm-input" 
                    value={crmName} 
                    onChange={e => setCrmName(e.target.value)}
                    placeholder="E.g. John Doe"
                  />
                </div>
                <div className="crm-field">
                  <label>Pipeline Stage</label>
                  <select 
                    className="crm-select" 
                    value={crmStatus} 
                    onChange={e => setCrmStatus(e.target.value)}
                  >
                    <option value="NEW">New</option>
                    <option value="LEAD">Lead</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="PROPOSAL">Proposal</option>
                    <option value="WON">Won</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
                <div className="crm-field">
                  <label>Internal Notes</label>
                  <textarea 
                    className="crm-textarea" 
                    value={crmNotes} 
                    onChange={e => setCrmNotes(e.target.value)}
                    placeholder="Private notes about this lead..."
                  />
                </div>
                {activeConvObj?.ad_source && (
                  <div className="crm-field" style={{ marginTop: '0.5rem' }}>
                    <label>Advertisement Source</label>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.75rem', borderRadius: '8px', color: '#60a5fa', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🎯</span> {activeConvObj.ad_source}
                    </div>
                  </div>
                )}
                <button 
                  className="save-btn" 
                  onClick={saveCrmData} 
                  disabled={isSavingCrm}
                  style={{
                    padding: '0.75rem',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '1rem',
                    opacity: isSavingCrm ? 0.7 : 1
                  }}
                >
                  {isSavingCrm ? 'Saving...' : 'Save Details'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ width: '100%' }}>
            <div className="empty-icon">💬</div>
            <h2>Select a conversation</h2>
            <p>Choose a contact from the sidebar to view your message history.</p>
          </div>
        )}
      </div>
    </div>
  );
}
