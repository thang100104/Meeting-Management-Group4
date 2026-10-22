import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Users, 
  Minus, 
  RotateCcw,
  Zap,
  QrCode
} from 'lucide-react';
import api from '../services/api';
import './ChatbotWidget.css';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  action?: string;
  data?: any;
  quickBookProposal?: any;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([
    '🎯 Gợi ý phòng họp 20 người',
    '📅 Lịch họp hôm nay của tôi',
    '⚡ Đặt phòng nhanh chiều nay',
    '🏢 Xem danh sách phòng trống',
    '📱 Điểm danh bằng QR'
  ]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '👋 Xin chào! Tôi là **MeetingBot** - Trợ lý đặt phòng thông minh của ICTU.\n\nTôi có thể giúp bạn tìm phòng tối ưu, đặt phòng nhanh chỉ bằng một câu chat, hoặc tra cứu lịch họp. Bạn cần hỗ trợ gì?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsLoading(true);

    try {
      const res = await api.post('/chatbot/message', { message: text });
      const data = res.data;

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.reply || 'Đã ghi nhận yêu cầu của bạn.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: data.action,
        data: data.data,
        quickBookProposal: data.action === 'PROMPT_QUICK_BOOK' ? data.data : undefined
      };

      setMessages(prev => [...prev, botMsg]);
      if (data.quick_replies && Array.isArray(data.quick_replies)) {
        setQuickReplies(data.quick_replies);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: '⚠️ Không thể kết nối với MeetingBot. Vui lòng kiểm tra lại kết nối mạng.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickBook = async (proposal: any) => {
    if (!proposal || isLoading) return;
    setIsLoading(true);

    try {
      const payload = {
        room_id: proposal.room_id,
        title: proposal.title || `Họp đặt nhanh qua MeetingBot`,
        start_time: proposal.start_time,
        end_time: proposal.end_time,
        description: `Đặt phòng nhanh qua trợ lý AI MeetingBot cho ${proposal.attendees || 15} người.`
      };

      const res = await api.post('/chatbot/quick-book', payload);
      const data = res.data;

      // Dispatch event to refresh calendar view
      window.dispatchEvent(new Event('roomBookingsUpdated'));
      window.dispatchEvent(new Event('request-updated'));

      const confirmMsg: Message = {
        id: Date.now().toString(),
        sender: 'bot',
        text: `🎉 **ĐẶT PHÒNG THÀNH CÔNG!**\n\n🏢 **${proposal.room_name}** (${proposal.location})\n⏰ ${proposal.start_display} - ${proposal.end_display}\n👥 Số lượng: ${proposal.attendees} người\n\n🔑 Mã cuộc họp: #${data.meeting?.meeting_id || ''}\n📱 Mã điểm danh QR đã được tự động sinh. Bạn có thể mở mục Lịch họp để lấy mã!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, confirmMsg]);
      setQuickReplies(['📅 Xem lịch họp của tôi', '⚡ Đặt thêm phòng', '🏢 Xem phòng trống']);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Không thể hoàn tất đặt phòng nhanh';
      const failMsg: Message = {
        id: Date.now().toString(),
        sender: 'bot',
        text: `❌ **Không thể đặt phòng:** ${detail}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, failMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: '👋 Xin chào! Tôi là **MeetingBot** - Trợ lý đặt phòng thông minh của ICTU.\n\nTôi có thể giúp bạn tìm phòng tối ưu, đặt phòng nhanh chỉ bằng một câu chat, hoặc tra cứu lịch họp. Bạn cần hỗ trợ gì?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setQuickReplies([
      '🎯 Gợi ý phòng họp 20 người',
      '📅 Lịch họp hôm nay của tôi',
      '⚡ Đặt phòng nhanh chiều nay',
      '🏢 Xem danh sách phòng trống',
      '📱 Điểm danh bằng QR'
    ]);
  };

  // Render text with markdown-style bolding and bullets
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Bold **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <div key={idx} style={{ marginBottom: line.trim() === '' ? '6px' : '2px' }}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return <code key={pIdx} style={{ backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>{part.slice(1, -1)}</code>;
            }
            return part;
          })}
        </div>
      );
    });
  };

  if (!isOpen) {
    return (
      <button 
        className="chatbot-toggle-btn" 
        onClick={() => setIsOpen(true)}
        title="Trợ lý AI MeetingBot (US #25)"
      >
        <span className="chatbot-pulse-dot" />
        <Bot size={28} />
      </button>
    );
  }

  return (
    <div className="chatbot-widget">
      {/* Header */}
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          <div className="chatbot-avatar">
            <Bot size={20} />
          </div>
          <div className="chatbot-title-area">
            <div className="chatbot-title-name">
              <span>MeetingBot</span>
              <span style={{ fontSize: '10px', backgroundColor: 'rgba(59, 130, 246, 0.3)', color: '#93c5fd', padding: '1px 6px', borderRadius: '10px' }}>AI Bot</span>
            </div>
            <div className="chatbot-status-text">
              <span className="chatbot-status-dot" />
              <span>Sẵn sàng hỗ trợ đặt phòng</span>
            </div>
          </div>
        </div>

        <div className="chatbot-actions">
          <button className="chatbot-action-btn" onClick={resetChat} title="Làm mới đoạn chat">
            <RotateCcw size={15} />
          </button>
          <button className="chatbot-action-btn" onClick={() => setIsOpen(false)} title="Đóng">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body / Chat stream */}
      <div className="chatbot-body">
        {messages.map(msg => (
          <div key={msg.id} className={`chatbot-msg-row ${msg.sender}`}>
            {msg.sender === 'bot' && (
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px' }}>
                <Bot size={16} />
              </div>
            )}
            <div className={`chatbot-msg-bubble ${msg.sender}`}>
              {renderFormattedText(msg.text)}

              {/* Interactive Quick-Book Proposal Card */}
              {msg.quickBookProposal && (
                <div className="chatbot-proposal-card">
                  <div className="chatbot-proposal-header">
                    <Sparkles size={16} color="#2563eb" />
                    <span>Đề xuất phòng tối ưu nhất</span>
                  </div>
                  <div className="chatbot-proposal-details">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#1e3a8a' }}>
                      <MapPin size={13} color="#2563eb" />
                      <span>{msg.quickBookProposal.room_name} ({msg.quickBookProposal.location})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={13} color="#059669" />
                      <span>Sức chứa: {msg.quickBookProposal.capacity} chỗ (cho {msg.quickBookProposal.attendees} người)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} color="#d97706" />
                      <span>{msg.quickBookProposal.start_display} - {msg.quickBookProposal.end_display}</span>
                    </div>
                  </div>
                  <button 
                    className="chatbot-proposal-btn"
                    onClick={() => handleQuickBook(msg.quickBookProposal)}
                    disabled={isLoading}
                  >
                    <Zap size={14} />
                    <span>Xác nhận đặt ngay (1-Click)</span>
                  </button>
                </div>
              )}

              <div className="chatbot-msg-time">{msg.timestamp}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chatbot-msg-row bot">
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={16} />
            </div>
            <div className="chatbot-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies chips */}
      {quickReplies.length > 0 && (
        <div className="chatbot-chips-area">
          {quickReplies.map((qr, idx) => (
            <button key={idx} className="chatbot-chip" onClick={() => handleSend(qr)}>
              {qr}
            </button>
          ))}
        </div>
      )}

      {/* Footer / Input */}
      <div className="chatbot-footer">
        <input 
          type="text" 
          placeholder="Nhắn tin với MeetingBot (vd: đặt phòng 20 người)..." 
          className="chatbot-input"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button 
          className="chatbot-send-btn" 
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isLoading}
          title="Gửi tin nhắn"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
