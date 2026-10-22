import React, { useState, useEffect, useRef } from 'react';
import { Send, Search, Phone, Video, Info, MoreVertical, Image as ImageIcon, Smile, Paperclip, MessageSquare } from 'lucide-react';
import { getStorage, setStorage, useDataSync } from '../utils/syncHelper';

export interface ChatMessage {
  id: string;
  senderEmail: string;
  senderName: string;
  senderAvatar?: string;
  receiverEmail: string; 
  receiverName?: string;
  text: string;
  timestamp: string;
  isRead: boolean;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file';
  attachmentName?: string;
}

interface Conversation {
  userEmail: string;
  userName: string;
  userAvatar?: string;
  lastMessage: ChatMessage;
  unreadCount: number;
}

export default function NotificationManagement() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAvatarInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
  };

  const loadData = () => {
    const allMessages = getStorage<ChatMessage[]>('meetinghub_chats', []);
    
    // Build conversations list
    const convosMap = new Map<string, Conversation>();
    
    // Sort all by timestamp first to get chronological order
    const sortedMessages = [...allMessages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    sortedMessages.forEach(msg => {
      // Determine the OTHER user (not ADMIN)
      let otherEmail = '';
      let otherName = '';
      let otherAvatar = '';
      let isUnread = false;

      const isToAdmin = msg.receiverEmail === 'ADMIN' || msg.receiverEmail === 'admin@ictu.edu.vn';
      const isFromAdmin = msg.senderEmail === 'ADMIN' || msg.senderEmail === 'admin@ictu.edu.vn';

      if (isToAdmin) {
        otherEmail = msg.senderEmail;
        otherName = msg.senderName;
        otherAvatar = msg.senderAvatar || '';
        if (!msg.isRead) isUnread = true;
      } else if (isFromAdmin) {
        otherEmail = msg.receiverEmail;
        otherName = msg.receiverName || msg.receiverEmail; 
      } else {
        return; // Not related to ADMIN
      }

      const existing = convosMap.get(otherEmail);
      if (!existing) {
        convosMap.set(otherEmail, {
          userEmail: otherEmail,
          userName: otherName,
          userAvatar: otherAvatar,
          lastMessage: msg,
          unreadCount: isUnread ? 1 : 0
        });
      } else {
        existing.lastMessage = msg;
        // Update name/avatar just in case it was missing
        if (isToAdmin) {
          existing.userName = msg.senderName;
          existing.userAvatar = msg.senderAvatar;
        }
        if (isUnread) existing.unreadCount += 1;
      }
    });

    // Convert map to array and sort by last message timestamp
    const convosArray = Array.from(convosMap.values());
    convosArray.sort((a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime());
    
    setConversations(convosArray);
    setMessages(sortedMessages);

    // If a user is selected, mark their messages as read
    if (selectedUser) {
      let hasChanges = false;
      const updatedMessages = allMessages.map(m => {
        if (m.senderEmail === selectedUser.userEmail && (m.receiverEmail === 'ADMIN' || m.receiverEmail === 'admin@ictu.edu.vn') && !m.isRead) {
          hasChanges = true;
          return { ...m, isRead: true };
        }
        return m;
      });
      if (hasChanges) {
        setStorage('meetinghub_chats', updatedMessages);
        // Also update local state so unread count updates immediately
        const activeConvo = convosArray.find(c => c.userEmail === selectedUser.userEmail);
        if (activeConvo) activeConvo.unreadCount = 0;
      }
    }
  };

  useDataSync('meetinghub_chats', loadData);

  useEffect(() => {
    loadData();
  }, [selectedUser?.userEmail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedUser]);

  const sendNewMessage = (text: string, attachmentUrl?: string, attachmentType?: 'image'|'file', attachmentName?: string) => {
    if (!selectedUser) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderEmail: 'ADMIN',
      senderName: 'Quản trị viên',
      receiverEmail: selectedUser.userEmail,
      text: text,
      timestamp: new Date().toISOString(),
      isRead: false,
      attachmentUrl,
      attachmentType,
      attachmentName
    };

    const allMessages = getStorage<ChatMessage[]>('meetinghub_chats', []);
    setStorage('meetinghub_chats', [...allMessages, newMessage]);
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedUser) return;
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

  const filteredConversations = conversations.filter(c => 
    c.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeMessages = messages.filter(m => 
    ((m.senderEmail === 'ADMIN' || m.senderEmail === 'admin@ictu.edu.vn') && m.receiverEmail === selectedUser?.userEmail) ||
    ((m.receiverEmail === 'ADMIN' || m.receiverEmail === 'admin@ictu.edu.vn') && m.senderEmail === selectedUser?.userEmail)
  );

  const emojis = ['😀', '😂', '😍', '🙏', '👍', '😢', '😡', '👏', '🎉', '❤️'];

  return (
    <div className="h-[calc(100vh-64px)] flex bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden my-4 mx-4 md:mx-8">
      
      {/* LEFT SIDEBAR - INBOX */}
      <div className="w-80 shrink-0 border-r border-slate-100 flex flex-col bg-slate-50/30">
        <div className="p-4 border-b border-slate-100 bg-white">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-4">
            <MessageSquare size={20} className="text-blue-600" />
            Hỗ trợ & Báo cáo
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm kiếm hội thoại..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredConversations.map(conv => (
                <button
                  key={conv.userEmail}
                  onClick={() => setSelectedUser(conv)}
                  className={`w-full p-4 flex items-start gap-3 transition-colors text-left
                    ${selectedUser?.userEmail === conv.userEmail 
                      ? 'bg-blue-50/50 hover:bg-blue-50/80' 
                      : 'hover:bg-slate-50'}
                  `}
                >
                  <div className="relative shrink-0">
                    {conv.userAvatar && (conv.userAvatar.startsWith('http') || conv.userAvatar.startsWith('data:image/')) ? (
                      <img src={conv.userAvatar} alt={conv.userName} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold shadow-sm">
                        {getAvatarInitials(conv.userName)}
                      </div>
                    )}
                    <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className={`text-sm truncate pr-2 ${conv.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {conv.userName}
                      </h3>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {new Date(conv.lastMessage.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                        {conv.lastMessage.senderEmail === 'ADMIN' ? 'Bạn: ' : ''}{conv.lastMessage.text}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] font-bold h-5 min-w-[20px] rounded-full flex items-center justify-center px-1.5 shadow-sm shadow-rose-500/20">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
              <MessageSquare size={40} className="mb-3 text-slate-200" />
              <p className="text-sm font-medium">Chưa có cuộc hội thoại nào</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE - CHAT WINDOW */}
      {selectedUser ? (
        <div className="flex-1 flex flex-col bg-white">
          {/* Chat Header */}
          <div className="h-[73px] border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              {selectedUser.userAvatar && (selectedUser.userAvatar.startsWith('http') || selectedUser.userAvatar.startsWith('data:image/')) ? (
                <img src={selectedUser.userAvatar} alt={selectedUser.userName} className="w-10 h-10 rounded-full object-cover shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold shadow-sm">
                  {getAvatarInitials(selectedUser.userName)}
                </div>
              )}
              <div>
                <h2 className="font-bold text-slate-900 text-[15px]">{selectedUser.userName}</h2>
                <p className="text-[11px] text-emerald-500 font-medium">{selectedUser.userEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <button className="p-2 hover:bg-slate-50 hover:text-slate-600 rounded-full transition-colors"><Phone size={18} /></button>
              <button className="p-2 hover:bg-slate-50 hover:text-slate-600 rounded-full transition-colors"><Video size={18} /></button>
              <button className="p-2 hover:bg-slate-50 hover:text-slate-600 rounded-full transition-colors"><Info size={18} /></button>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <button className="p-2 hover:bg-slate-50 hover:text-slate-600 rounded-full transition-colors"><MoreVertical size={18} /></button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6" onClick={() => setShowEmoji(false)}>
            <div className="flex justify-center mb-6">
              <div className="bg-slate-100 text-slate-500 text-[11px] font-medium px-4 py-1.5 rounded-full">
                Bắt đầu cuộc hội thoại
              </div>
            </div>

            {activeMessages.map((msg, idx) => {
              const isMe = msg.senderEmail === 'ADMIN';
              const showAvatar = !isMe && (idx === 0 || activeMessages[idx-1].senderEmail !== msg.senderEmail);

              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`flex max-w-[70%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {!isMe && (
                      <div className="w-8 shrink-0">
                        {showAvatar ? (
                          selectedUser.userAvatar && (selectedUser.userAvatar.startsWith('http') || selectedUser.userAvatar.startsWith('data:image/')) ? (
                            <img src={selectedUser.userAvatar} alt={selectedUser.userName} className="w-8 h-8 rounded-full object-cover shadow-sm" />
                          ) : (
                            <div className="h-8 w-8 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center text-slate-600 text-[10px] font-bold shadow-sm">
                              {getAvatarInitials(selectedUser.userName)}
                            </div>
                          )
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
            <div className="absolute bottom-[80px] left-4 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 flex gap-2 flex-wrap max-w-[280px] z-50">
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
                placeholder="Nhập tin nhắn phản hồi..."
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
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/30 text-slate-400">
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <MessageSquare size={40} className="text-blue-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Hộp thư hỗ trợ</h3>
          <p className="text-sm">Chọn một đoạn hội thoại để xem và phản hồi tin nhắn</p>
        </div>
      )}
    </div>
  );
}
