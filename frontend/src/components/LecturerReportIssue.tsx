import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, Video, Info, MoreVertical, Image as ImageIcon, Smile, Paperclip } from 'lucide-react';
import { getStorage, setStorage, useDataSync } from '../utils/syncHelper';
import { addNotification } from '../utils/notificationService';

export interface ChatMessage {
  id: string;
  senderEmail: string;
  senderName: string;
  senderAvatar?: string;
  receiverEmail: string; // 'ADMIN' for admin
  text: string;
  timestamp: string;
  isRead: boolean;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file';
  attachmentName?: string;
}

export default function LecturerReportIssue({ userProfile }: { userProfile: any }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUserEmail = userProfile?.email || 'lecturer@school.edu.vn';
  const currentUserName = userProfile?.fullName || 'Người dùng';
  
  const getAvatarInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
  };

  const loadMessages = () => {
    const allMessages = getStorage<ChatMessage[]>('meetinghub_chats', []);
    const myMessages = allMessages.filter(m => m.senderEmail === currentUserEmail || m.receiverEmail === currentUserEmail);
    myMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    let hasChanges = false;
    const updatedMessages = allMessages.map(m => {
      if (m.receiverEmail === currentUserEmail && !m.isRead) {
        hasChanges = true;
        return { ...m, isRead: true };
      }
      return m;
    });

    if (hasChanges) {
      setStorage('meetinghub_chats', updatedMessages);
    }
    
    setMessages(myMessages);
  };

  useDataSync('meetinghub_chats', loadMessages);

  useEffect(() => {
    loadMessages();
  }, [userProfile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendNewMessage = (text: string, attachmentUrl?: string, attachmentType?: 'image'|'file', attachmentName?: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderEmail: currentUserEmail,
      senderName: currentUserName,
      senderAvatar: userProfile?.avatar || userProfile?.avatar_url,
      receiverEmail: 'ADMIN',
      text: text,
      timestamp: new Date().toISOString(),
      isRead: false,
      attachmentUrl,
      attachmentType,
      attachmentName
    };

    const allMessages = getStorage<ChatMessage[]>('meetinghub_chats', []);
    setStorage('meetinghub_chats', [...allMessages, newMessage]);

    // Bắn thông báo tương ứng cho từng vai trò người nhận:
    const role = (userProfile?.role || '').toLowerCase();
    const isStudent = role === 'student' || role === 'participant' || role === 'sinh viên';
    
    if (isStudent) {
      // Sinh viên nhắn -> Báo cho Giảng viên
      addNotification({
        title: `Tin nhắn từ Sinh viên ${currentUserName}`,
        content: `Sinh viên ${currentUserName}: "${text}"`,
        targetRole: 'lecturer',
        senderRole: 'student',
        senderName: currentUserName,
        type: 'message'
      });
    } else {
      // Giảng viên nhắn -> Báo cho Quản trị viên
      addNotification({
        title: `Tin nhắn từ GV ${currentUserName}`,
        content: `GV ${currentUserName}: "${text}"`,
        targetRole: 'admin',
        senderRole: 'lecturer',
        senderName: currentUserName,
        type: 'message'
      });
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    sendNewMessage(inputText.trim());
    setInputText('');
    setShowEmoji(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image'|'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      sendNewMessage(file.name, dataUrl, type, file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  const emojis = ['😀', '😂', '😍', '🙏', '👍', '😢', '😡', '👏', '🎉', '❤️'];

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 flex flex-col h-[calc(100vh-80px)]">
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col max-w-5xl mx-auto w-full relative">
        
        {/* Chat Header */}
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                Q
              </div>
              <div className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white"></div>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-[15px]">Quản trị viên & Kỹ thuật</h2>
              <p className="text-[12px] text-emerald-500 font-medium">Đang hoạt động</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors"><Phone size={18} /></button>
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors"><Video size={18} /></button>
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors"><Info size={18} /></button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6" onClick={() => setShowEmoji(false)}>
          <div className="flex justify-center mb-8">
            <div className="bg-blue-50 text-blue-800 text-xs font-medium px-4 py-2 rounded-full border border-blue-100/50">
              Bạn đang nhắn tin trực tiếp với bộ phận Quản trị và Kỹ thuật. Hãy gửi báo cáo sự cố tại đây!
            </div>
          </div>

          {messages.map((msg, idx) => {
            const isMe = msg.senderEmail === currentUserEmail;
            const showAvatar = !isMe && (idx === 0 || messages[idx-1].senderEmail !== msg.senderEmail);

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                <div className={`flex max-w-[70%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {!isMe && (
                    <div className="w-8 shrink-0">
                      {showAvatar ? (
                        <div className="h-8 w-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                          Q
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {msg.attachmentType === 'image' && msg.attachmentUrl && (
                      <div className="mb-1">
                        <img src={msg.attachmentUrl} alt="attachment" className="max-w-[200px] md:max-w-[280px] rounded-2xl object-cover shadow-sm border border-slate-100" />
                      </div>
                    )}
                    
                    {(msg.attachmentType === 'file' || (msg.text && (msg.attachmentType !== 'image' || msg.text !== msg.attachmentName))) && (
                      <div className={`
                        px-4 py-2.5 rounded-2xl text-[14px] shadow-sm relative
                        ${isMe 
                          ? 'bg-blue-600 text-white rounded-br-sm' 
                          : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'}
                      `}>
                        {msg.attachmentType === 'file' && msg.attachmentUrl && (
                          <a href={msg.attachmentUrl} download={msg.attachmentName} className={`flex items-center gap-2 mb-1 p-2 rounded-lg transition-colors ${isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-black/5 hover:bg-black/10 text-slate-700'}`}>
                            <Paperclip size={16} />
                            <span className="text-xs font-medium truncate max-w-[180px]">{msg.attachmentName}</span>
                          </a>
                        )}
                        
                        {(msg.text && msg.text !== msg.attachmentName) ? (
                          <span>{msg.text}</span>
                        ) : (
                          msg.attachmentType === 'file' && <span className={isMe ? 'text-blue-100 text-xs' : 'text-slate-500 text-xs'}>Tệp đính kèm</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400">
                      {new Date(msg.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                      {isMe && (
                        <span className="ml-1">
                          {msg.isRead ? <span className="text-blue-500">Đã xem</span> : <span>Đã gửi</span>}
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Emoji Picker */}
        {showEmoji && (
          <div className="absolute bottom-[80px] left-4 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 flex gap-2 flex-wrap max-w-[280px]">
            {emojis.map(emoji => (
              <button 
                key={emoji} 
                onClick={() => setInputText(prev => prev + emoji)}
                className="text-xl p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Hidden File Inputs */}
        <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
        <input type="file" ref={fileInputRef} accept="*/*" className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />

        {/* Chat Input */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <form onSubmit={handleSend} className="flex items-end gap-2 bg-slate-50 border border-slate-200/60 rounded-2xl p-2 transition-all focus-within:bg-white focus-within:border-blue-300 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.1)]">
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className={`p-2.5 hover:bg-slate-100 rounded-xl transition-colors shrink-0 ${showEmoji ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}>
              <Smile size={20} />
            </button>
            <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
              <ImageIcon size={20} />
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0 mr-1">
              <Paperclip size={20} />
            </button>
            
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Nhập nội dung báo cáo sự cố..."
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 text-[14px] text-slate-700 py-3 placeholder:text-slate-400"
              rows={1}
              style={{ minHeight: '44px' }}
            />
            
            <button 
              type="submit"
              disabled={!inputText.trim()}
              className={`p-3 rounded-xl transition-all shrink-0 mb-0.5 mr-0.5
                ${inputText.trim() 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
              `}
            >
              <Send size={18} className={inputText.trim() ? "translate-x-0.5 -translate-y-0.5 transition-transform" : ""} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
