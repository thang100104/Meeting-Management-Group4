import React, { useState } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import './ChatbotWidget.css';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button className="chatbot-toggle-btn" onClick={() => setIsOpen(true)}>
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div className="chatbot-widget">
      <div className="chatbot-header">
        <div className="chatbot-title">
          <MessageSquare size={18} />
          <span>MeetingBot</span>
        </div>
        <div className="chatbot-actions">
          <button className="chatbot-action-btn" onClick={() => setIsOpen(false)}>
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="chatbot-body">
        {/* Messages would go here */}
      </div>
      <div className="chatbot-footer">
        <input type="text" placeholder="Type a message..." className="chatbot-input" />
      </div>
    </div>
  );
}
