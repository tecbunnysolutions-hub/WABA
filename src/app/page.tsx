"use client";

import { useEffect, useState, useRef } from "react";

type Message = {
  id: string;
  sender_number: string;
  direction: 'INBOUND' | 'OUTBOUND';
  message_content: string;
  timestamp: string;
  status: string;
};

type Conversation = {
  id: number;
  sender_number: string;
  last_interaction_timestamp: string;
  messages?: Message[];
};

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation);
      const interval = setInterval(() => fetchMessages(activeConversation), 3000);
      return () => clearInterval(interval);
    }
  }, [activeConversation]);

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

    // Optimistic update
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
      } else {
        console.error('Failed to send');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="glass-panel sidebar">
        <div className="sidebar-header">
          <h2>WABA Messages</h2>
        </div>
        <div className="conversation-list">
          {loading ? (
            <div className="spinner"></div>
          ) : (
            conversations.map(conv => (
              <div 
                key={conv.id} 
                className={`conversation-item ${activeConversation === conv.sender_number ? 'active' : ''}`}
                onClick={() => setActiveConversation(conv.sender_number)}
              >
                <div className="avatar">{conv.sender_number.substring(0, 2)}</div>
                <div className="conversation-details">
                  <span className="sender">{conv.sender_number}</span>
                  <span className="last-msg">
                    {conv.messages?.[0]?.message_content || 'No messages'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="glass-panel chat-area">
        {activeConversation ? (
          <>
            <div className="chat-header">
              <h3>{activeConversation}</h3>
            </div>
            <div className="messages-container">
              {messages.map(msg => (
                <div key={msg.id} className={`message-wrapper ${msg.direction.toLowerCase()}`}>
                  <div className="message-bubble">
                    <p>{msg.message_content}</p>
                    <span className="time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
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
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h2>Select a conversation</h2>
            <p>Choose a contact from the sidebar to view your message history.</p>
          </div>
        )}
      </div>
    </div>
  );
}
