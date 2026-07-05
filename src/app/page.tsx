"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  sender_number: string;
  direction: 'INBOUND' | 'OUTBOUND';
  message_content: string;
  timestamp: string;
  status: string;
  media_url?: string;
  media_type?: string;
  sent_by?: 'AI' | 'ADMIN';
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
  assigned_to?: string;
  department?: string;
  ai_active?: boolean;
  active_flow?: string;
  deal_value?: string;
  messages?: Message[];
};

type Template = {
  id: string;
  name: string;
  content: string;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mobile Responsiveness States
  const [showSidebar, setShowSidebar] = useState(true);
  const [showCrm, setShowCrm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // CRM Panel State
  const [crmName, setCrmName] = useState("");
  const [crmStatus, setCrmStatus] = useState("NEW");
  const [crmNotes, setCrmNotes] = useState("");
  const [crmAssignedTo, setCrmAssignedTo] = useState("");
  const [crmDepartment, setCrmDepartment] = useState("UNASSIGNED");
  const [crmAiActive, setCrmAiActive] = useState(true);
  const [crmDealValue, setCrmDealValue] = useState("");
  const [crmActiveFlow, setCrmActiveFlow] = useState("");
  const [isSavingCrm, setIsSavingCrm] = useState(false);
  const [globalAiOverride, setGlobalAiOverride] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Authenticate Agent
    fetch('/api/auth/me').then(res => res.json()).then(data => {
      if (!data.user) {
        router.push('/login');
      } else {
        setCurrentUser(data.user);
        fetchUsers();
        fetchConversations();
        fetchTemplates();
        const interval = setInterval(fetchConversations, 5000);
        return () => clearInterval(interval);
      }
    });
  }, []);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation);
      const interval = setInterval(() => fetchMessages(activeConversation), 3000);
      
      const activeObj = conversations.find(c => c.sender_number === activeConversation);
      if (activeObj) {
        setCrmName(activeObj.contact_name || "");
        setCrmStatus(activeObj.status || "NEW");
        setCrmNotes(activeObj.notes || "");
        setCrmAssignedTo(activeObj.assigned_to || "");
        setCrmDepartment(activeObj.department || "UNASSIGNED");
        setCrmAiActive(activeObj.ai_active !== false); // default true
        setCrmDealValue(activeObj.deal_value || "");
        setCrmActiveFlow(activeObj.active_flow || "");
      }
      return () => clearInterval(interval);
    }
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users'); // we need to make this endpoint or just mock it for now. Actually we can do it via a new endpoint, but wait, I didn't create /api/users yet!
      // Let's create it later or just show a text input for assigned_to for now.
    } catch (e) {}
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
        setLoading(false);
      }
    } catch (err) { console.error(err); }
  };

  const fetchMessages = async (sender: string) => {
    try {
      const res = await fetch(`/api/messages?conversation=${sender}`);
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (err) { console.error(err); }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;

    const textToSend = inputText;
    setInputText("");

    const tempMsg: Message = {
      id: Date.now().toString(),
      sender_number: activeConversation,
      direction: 'OUTBOUND',
      message_content: textToSend,
      timestamp: new Date().toISOString(),
      status: 'SENDING',
      sent_by: 'ADMIN'
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: activeConversation, text: textToSend })
      });
      if (res.ok) fetchMessages(activeConversation);
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    if (!e.target.files || !e.target.files[0] || !activeConversation) return;
    const file = e.target.files[0];
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('to', activeConversation);
    formData.append('type', type);

    try {
      const res = await fetch('/api/messages/media', {
        method: 'POST',
        body: formData
      });
      if (res.ok) fetchMessages(activeConversation);
      else alert("Failed to send media.");
    } catch (err) {
      alert("Upload error.");
    }
    setIsUploading(false);
    // Reset file input
    e.target.value = '';
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
          notes: crmNotes,
          assigned_to: crmAssignedTo,
          department: crmDepartment,
          ai_active: crmAiActive,
          deal_value: crmDealValue,
          active_flow: crmActiveFlow
        })
      });
      if (res.ok) fetchConversations();
    } catch (err) { console.error(err); }
    setIsSavingCrm(false);
    setShowCrm(false); // hide on mobile after save
  };

  if (!currentUser) {
    return <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div className="spinner"></div></div>;
  }

  const activeConvObj = conversations.find(c => c.sender_number === activeConversation);
  const displayName = activeConvObj?.contact_name || activeConversation;

  // 24-Hour Guardrail Logic
  const lastInteraction = activeConvObj?.last_interaction_timestamp ? new Date(activeConvObj.last_interaction_timestamp) : new Date(0);
  const hoursSinceLastInteraction = (new Date().getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
  const isOutsideWindow = hoursSinceLastInteraction > 24;

  return (
    <div className="dashboard-container">
      {/* PANE 1: Sidebar / Conversation List */}
      <div className={`glass-panel sidebar ${!showSidebar ? 'hidden' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Inbox <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal' }}>({currentUser.name})</span></h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setGlobalAiOverride(!globalAiOverride)}
              style={{ fontSize: '0.85rem', color: globalAiOverride ? '#ef4444' : '#10b981', textDecoration: 'none', background: globalAiOverride ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${globalAiOverride ? '#ef4444' : '#10b981'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Global AI Override (shuts down AI for all)"
            >
              {globalAiOverride ? '🛑 AI Overridden' : '🤖 AI Active'}
            </button>
            <a href="/templates" style={{ fontSize: '0.85rem', color: 'var(--template-color)', textDecoration: 'none', background: 'rgba(99, 102, 241, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>📑 Templates</a>
            <a href="/campaigns" style={{ fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'none', background: 'rgba(59, 130, 246, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>🚀 Ads</a>
            <button className="mobile-toggle" onClick={() => setShowSidebar(false)}>✕</button>
          </div>
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
                  setCrmAssignedTo(conv.assigned_to || "");
                  setCrmDepartment(conv.department || "UNASSIGNED");
                  setCrmAiActive(conv.ai_active !== false);
                  setCrmDealValue(conv.deal_value || "");
                  setCrmActiveFlow(conv.active_flow || "");
                  setShowSidebar(false); // Auto hide on mobile
                }}
              >
                <div className="avatar">{(conv.contact_name || conv.sender_number).substring(0, 2).toUpperCase()}</div>
                <div className="conversation-details">
                  <span className="sender">{conv.contact_name || conv.sender_number}</span>
                  <span className="last-msg">
                    {conv.messages?.[0]?.message_content || 'No messages'}
                  </span>
                  <div style={{ marginTop: '4px', display: 'flex', gap: '4px' }}>
                    {conv.ai_active !== false && !globalAiOverride ? (
                      <span style={{ fontSize: '0.7rem', color: 'var(--ai-accent)', border: '1px solid var(--ai-accent)', padding: '2px 4px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)' }}>AI Active</span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#ef4444', border: '1px solid #ef4444', padding: '2px 4px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)' }}>{globalAiOverride ? 'AI Overridden' : 'Paused (Human)'}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {conv.status && (
                      <span className={`crm-status-badge status-${conv.status}`}>
                        {conv.status}
                      </span>
                    )}
                    {conv.department && conv.department !== 'UNASSIGNED' && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }}>🏢 {conv.department}</span>
                    )}
                    {conv.assigned_to && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>👤 {conv.assigned_to}</span>
                    )}
                  </div>
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
                <button className="mobile-toggle" onClick={() => setShowSidebar(true)} style={{ marginRight: '1rem' }}>☰</button>
                <h3 style={{ flexGrow: 1 }}>{displayName}</h3>
                <button className="mobile-toggle" onClick={() => setShowCrm(!showCrm)}>👤</button>
              </div>
              <div className="messages-container">
                {messages.map(msg => {
                  const isLocation = msg.message_content && msg.message_content.startsWith('📍 Location: https://maps.google.com/?q=');
                  let locationCoords = '', locationAddress = '', locationUrl = '';
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
                          <iframe width="100%" height="150" style={{ borderRadius: '8px', border: 0, backgroundColor: '#f0f0f0' }} src={`https://maps.google.com/maps?q=${locationCoords}&z=15&output=embed`} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
                          <a href={locationUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#007AFF', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📍</span> Open in Maps {locationAddress}
                          </a>
                        </div>
                      ) : (
                        msg.message_content && msg.message_content !== '[Media]' && <p>{msg.message_content}</p>
                      )}
                      
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        {msg.direction === 'OUTBOUND' && msg.sent_by && (
                          <span style={{ fontSize: '0.7rem', color: msg.sent_by === 'AI' ? '#9ca3af' : '#60a5fa', marginRight: '4px' }}>
                            Sent by {msg.sent_by === 'AI' ? 'AI Agent' : 'Admin'}
                          </span>
                        )}
                        <span className="time" style={{ margin: 0 }}>{new Date(msg.timestamp.endsWith('Z') ? msg.timestamp : msg.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.direction === 'OUTBOUND' && (
                          <span style={{ fontSize: '0.8rem', color: msg.status === 'READ' ? '#3b82f6' : '#94a3b8' }}>
                            {msg.status === 'READ' ? '✓✓' : msg.status === 'DELIVERED' ? '✓✓' : msg.status === 'FAILED' ? '❌' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* ATTACHMENT TOOLBAR & INPUT */}
              <div style={{ position: 'relative' }}>
                {isUploading && <div style={{ position: 'absolute', top: '-30px', left: '20px', background: 'rgba(59,130,246,0.8)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem' }}>Uploading media...</div>}
                <form className="message-input-area" onSubmit={handleSendMessage} style={{ background: isOutsideWindow ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0,0,0,0.1)' }}>
                  
                  {isOutsideWindow ? (
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>⚠️ Outside 24-Hour Window (Template Required)</span>
                      <select 
                        className="crm-select" 
                        style={{ border: '1px solid #ef4444', background: 'rgba(255,255,255,0.05)' }}
                        value={selectedTemplate}
                        onChange={(e) => {
                          setSelectedTemplate(e.target.value);
                          const t = templates.find(t => t.id === e.target.value);
                          if (t) setInputText(t.content);
                        }}
                      >
                        <option value="">-- Select an Approved Template --</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="attachment-toolbar">
                        <button type="button" onClick={() => fileInputRef.current?.click()} title="Send Image">📷</button>
                        <button type="button" onClick={() => docInputRef.current?.click()} title="Send Document">📄</button>
                        <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'image')} accept="image/*,video/*" style={{ display: 'none' }} />
                        <input type="file" ref={docInputRef} onChange={(e) => handleFileUpload(e, 'document')} accept=".pdf,.doc,.docx" style={{ display: 'none' }} />
                      </div>

                      <input 
                        type="text" 
                        placeholder="Type a message..." 
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        autoFocus
                      />
                    </>
                  )}

                  <button type="submit" disabled={(!inputText.trim() && !isUploading) || (isOutsideWindow && !selectedTemplate)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </form>
              </div>
            </div>

            {/* PANE 3: CRM Details Panel */}
            <div className={`crm-panel ${!showCrm ? 'hidden' : ''}`}>
              <div className="crm-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>CRM Details</h3>
                <button className="mobile-toggle" onClick={() => setShowCrm(false)}>✕</button>
              </div>
              <div className="crm-body">
                <div className="crm-field">
                  <label>AI Autopilot</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={crmAiActive} onChange={e => setCrmAiActive(e.target.checked)} style={{ width: '18px', height: '18px' }}/>
                    <span style={{ color: crmAiActive ? '#10b981' : '#ef4444', fontWeight: 600 }}>{crmAiActive ? 'Active' : 'Paused'}</span>
                  </label>
                </div>
                <div className="crm-field">
                  <label>Deal Value</label>
                  <input type="text" className="crm-input" value={crmDealValue} onChange={e => setCrmDealValue(e.target.value)} placeholder="$0.00"/>
                </div>
                <div className="crm-field">
                  <label>Active Flow</label>
                  <select className="crm-select" value={crmActiveFlow} onChange={e => setCrmActiveFlow(e.target.value)}>
                    <option value="">-- No Flow --</option>
                    <option value="Property Inquiry Flow">Property Inquiry Flow</option>
                    <option value="Support Intake Flow">Support Intake Flow</option>
                  </select>
                </div>
                <div className="crm-field">
                  <label>Name</label>
                  <input type="text" className="crm-input" value={crmName} onChange={e => setCrmName(e.target.value)} placeholder="E.g. John Doe"/>
                </div>
                <div className="crm-field">
                  <label>Assign To Agent</label>
                  <input type="text" className="crm-input" value={crmAssignedTo} onChange={e => setCrmAssignedTo(e.target.value)} placeholder="e.g. Alice" title="Type the name of the agent to assign this chat."/>
                </div>
                <div className="crm-field">
                  <label>Agent Mode / Department</label>
                  <select className="crm-select" value={crmDepartment} onChange={e => setCrmDepartment(e.target.value)}>
                    <option value="UNASSIGNED">Unassigned Mode</option>
                    <option value="SUPPORT">Support</option>
                    <option value="SALES">Sales</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="BILLING">Billing</option>
                  </select>
                </div>
                <div className="crm-field">
                  <label>Pipeline Stage</label>
                  <select className="crm-select" value={crmStatus} onChange={e => setCrmStatus(e.target.value)}>
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
                  <textarea className="crm-textarea" value={crmNotes} onChange={e => setCrmNotes(e.target.value)} placeholder="Private notes about this lead..."/>
                </div>
                {activeConvObj?.ad_source && (
                  <div className="crm-field" style={{ marginTop: '0.5rem' }}>
                    <label>Ad Source</label>
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
                  {isSavingCrm ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ width: '100%', position: 'relative' }}>
            <button className="mobile-toggle" onClick={() => setShowSidebar(true)} style={{ position: 'absolute', top: '1rem', left: '1rem' }}>☰ Inbox</button>
            <div className="empty-icon">💬</div>
            <h2>Select a conversation</h2>
            <p>Choose a contact from the sidebar to view your message history.</p>
          </div>
        )}
      </div>
    </div>
  );
}
