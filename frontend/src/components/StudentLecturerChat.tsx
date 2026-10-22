import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Search, User, MessageSquare, CheckCheck, Clock, 
  Smile, ShieldCheck, X, Sparkles, Building2, UserCheck,
  GraduationCap, BookOpen, AlertCircle
} from 'lucide-react';
import { getStorage, setStorage, useDataSync } from '../utils/syncHelper';
import { addNotification } from '../utils/notificationService';
import api from '../services/api';

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

export interface ChatContact {
  id: string | number;
  name: string;
  fullName?: string;
  email: string;
  role: 'admin' | 'lecturer' | 'student' | 'user';
  roleName?: string;
  department?: string;
  avatar?: string;
  online?: boolean;
  isAdmin?: boolean;
}

// Tài khoản Quản trị viên luôn sẵn sàng hỗ trợ mọi lúc (Ẩn danh hệ thống)
export const ADMIN_CONTACT: ChatContact = {
  id: 'admin_sys',
  name: 'Quản trị viên Hệ thống',
  fullName: 'Quản trị viên Hệ thống',
  email: 'admin@ictu.edu.vn',
  role: 'admin',
  roleName: 'Quản trị viên',
  department: 'Ban Quản trị & Hỗ trợ kỹ thuật',
  avatar: 'https://ui-avatars.com/api/?name=Admin+ICTU&background=0f172a&color=38bdf8',
  online: true,
  isAdmin: true
};

export const resolveUserAvatar = (user: { email?: string; avatar_url?: string; avatar?: string; full_name?: string; name?: string }) => {
  const email = (user.email || '').toLowerCase();

  // 1. Nếu là Admin
  if (email === 'admin@ictu.edu.vn' || email === 'admin') {
    return 'https://ui-avatars.com/api/?name=Admin+ICTU&background=0f172a&color=38bdf8';
  }

  // 2. Nếu có avatar thực tế từ Database (Base64 hoặc URL)
  if (user.avatar_url && user.avatar_url.trim() && !user.avatar_url.includes('ui-avatars.com')) {
    return user.avatar_url;
  }
  if (user.avatar && user.avatar.trim() && !user.avatar.includes('ui-avatars.com')) {
    return user.avatar;
  }

  // 3. Fallback ảnh avatar mẫu có sẵn trong hệ thống
  if (email.includes('hoangphuong')) {
    return '/hoang_phuong_avatar.png';
  }
  if (email.includes('nguyenphuong')) {
    return '/phuong_account_avatar.png';
  }

  // 4. Fallback avatar theo tên
  const displayName = user.full_name || user.name || 'User';
  return user.avatar_url || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0284c7&color=fff`;
};

interface StudentLecturerChatProps {
  currentRole: 'student' | 'lecturer' | 'user';
  userProfile: any;
}

export default function StudentLecturerChat({ currentRole, userProfile }: StudentLecturerChatProps) {
  const myEmail = userProfile?.email || (currentRole === 'student' ? 'tranlinh@ictu.edu.vn' : 'hoangphuong@ictu.edu.vn');
  const myName = userProfile?.fullName || userProfile?.name || 'Người dùng';
  const myAvatar = userProfile?.avatar || userProfile?.avatarUrl;
  const isMeAdmin = myEmail.toLowerCase() === 'admin@ictu.edu.vn' || (userProfile?.role || '').toLowerCase() === 'admin';

  const [contacts, setContacts] = useState<ChatContact[]>(() => {
    // Luôn có Admin cho tài khoản người dùng thông thường
    return isMeAdmin ? [] : [ADMIN_CONTACT];
  });
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(() => {
    return isMeAdmin ? null : ADMIN_CONTACT;
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatContact[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() => {
    return getStorage<ChatMessage[]>('meetinghub_chats', []);
  });
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Tải danh sách liên hệ đã từng nhắn tin từ meetinghub_chats + danh sách người dùng ban đầu
  useEffect(() => {
    const loadInitialContacts = async () => {
      const chats = getStorage<ChatMessage[]>('meetinghub_chats', []);
      const userEmails = new Set<string>();

      // Lấy danh sách email đã từng nhắn qua lại
      chats.forEach(m => {
        if (m.senderEmail?.toLowerCase() === myEmail.toLowerCase() && m.receiverEmail) {
          userEmails.add(m.receiverEmail.toLowerCase());
        }
        if (m.receiverEmail?.toLowerCase() === myEmail.toLowerCase() && m.senderEmail) {
          userEmails.add(m.senderEmail.toLowerCase());
        }
      });

      let loadedContacts: ChatContact[] = [];

      // Luôn ghim Admin lên đầu nếu tôi không phải Admin
      if (!isMeAdmin) {
        loadedContacts.push(ADMIN_CONTACT);
        userEmails.delete('admin@ictu.edu.vn');
        userEmails.delete('admin');
      }

      // Lấy thông tin các người dùng đã từng nhắn từ API
      try {
        const res = await api.get('/meetings/search-users?limit=30');
        if (Array.isArray(res.data)) {
          const apiUsers: ChatContact[] = res.data
            .filter((u: any) => u.email?.toLowerCase() !== myEmail.toLowerCase())
            .map((u: any) => ({
              id: u.user_id,
              name: u.full_name,
              fullName: u.full_name,
              email: u.email,
              role: u.role_name === 'ADMIN' ? 'admin' : (u.role_name === 'ORGANIZER' ? 'lecturer' : 'student'),
              roleName: u.role_name === 'ADMIN' ? 'Quản trị viên' : (u.role_name === 'ORGANIZER' ? 'Giảng viên' : (u.role_name === 'PARTICIPANT' ? 'Sinh viên' : u.role_name || 'Người dùng')),
              department: u.department_name || 'ICTU',
              avatar: resolveUserAvatar(u),
              online: true,
              isAdmin: u.role_name === 'ADMIN' || u.email?.toLowerCase() === 'admin@ictu.edu.vn'
            }));

          // Đưa những người từng nhắn tin lên trước
          apiUsers.forEach(u => {
            if (u.email.toLowerCase() === 'admin@ictu.edu.vn') {
              if (isMeAdmin) {
                // Admin không tự chat với mình
                return;
              }
            } else if (!loadedContacts.some(c => c.email.toLowerCase() === u.email.toLowerCase())) {
              loadedContacts.push(u);
            }
          });
        }
      } catch (err) {
        console.warn('Lỗi tải danh sách người dùng ban đầu từ API', err);
      }

      setContacts(loadedContacts);

      // Nếu chưa chọn ai, mặc định chọn Admin (hoặc người đầu tiên nếu tôi là admin)
      if (!selectedContact && loadedContacts.length > 0) {
        setSelectedContact(loadedContacts[0]);
      }
    };

    loadInitialContacts();
  }, [myEmail, isMeAdmin]);

  // 2. Tìm kiếm người dùng qua API theo tên hoặc email khi người dùng gõ trên thanh tìm kiếm
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/meetings/search-users?q=${encodeURIComponent(trimmed)}&limit=20`);
        const results: ChatContact[] = [];

        // Nếu từ khóa tìm kiếm khớp với admin và tôi không phải admin, thêm admin vào kết quả
        if (!isMeAdmin) {
          const matchAdmin = 'quản trị viên hệ thống'.includes(trimmed.toLowerCase()) || 
                             'admin@ictu.edu.vn'.includes(trimmed.toLowerCase()) ||
                             'admin'.includes(trimmed.toLowerCase());
          if (matchAdmin) {
            results.push(ADMIN_CONTACT);
          }
        }

        if (Array.isArray(res.data)) {
          res.data
            .filter((u: any) => u.email?.toLowerCase() !== myEmail.toLowerCase())
            .forEach((u: any) => {
              if (u.email?.toLowerCase() === 'admin@ictu.edu.vn' && !isMeAdmin) {
                if (!results.some(r => r.email === 'admin@ictu.edu.vn')) {
                  results.push(ADMIN_CONTACT);
                }
              } else if (!results.some(r => r.email.toLowerCase() === u.email.toLowerCase())) {
                results.push({
                  id: u.user_id,
                  name: u.full_name,
                  fullName: u.full_name,
                  email: u.email,
                  role: u.role_name === 'ADMIN' ? 'admin' : (u.role_name === 'ORGANIZER' ? 'lecturer' : 'student'),
                  roleName: u.role_name === 'ADMIN' ? 'Quản trị viên' : (u.role_name === 'ORGANIZER' ? 'Giảng viên' : (u.role_name === 'PARTICIPANT' ? 'Sinh viên' : u.role_name || 'Người dùng')),
                  department: u.department_name || 'ICTU',
                  avatar: resolveUserAvatar(u),
                  online: true,
                  isAdmin: u.role_name === 'ADMIN' || u.email?.toLowerCase() === 'admin@ictu.edu.vn'
                });
              }
            });
        }
        setSearchResults(results);
      } catch (err) {
        console.warn('Lỗi tìm kiếm người dùng từ API', err);
        // Fallback: Tìm trong danh bạ hiện có
        const localMatched = contacts.filter(c => 
          c.name.toLowerCase().includes(trimmed.toLowerCase()) ||
          c.email.toLowerCase().includes(trimmed.toLowerCase())
        );
        setSearchResults(localMatched);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, myEmail, isMeAdmin, contacts]);

  // 3. Lắng nghe cập nhật tin nhắn real-time
  const refreshMessages = () => {
    const saved = getStorage<ChatMessage[]>('meetinghub_chats', []);
    setAllMessages(saved);
  };

  useDataSync('meetinghub_chats', refreshMessages);

  useEffect(() => {
    window.addEventListener('storage', refreshMessages);
    window.addEventListener('appDataSync', refreshMessages);
    return () => {
      window.removeEventListener('storage', refreshMessages);
      window.removeEventListener('appDataSync', refreshMessages);
    };
  }, []);

  // Cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, selectedContact]);

  // Lọc cuộc trò chuyện giữa tôi và đối phương đang chọn
  const isPartnerAdmin = selectedContact?.isAdmin || 
                         selectedContact?.email.toLowerCase() === 'admin@ictu.edu.vn' || 
                         selectedContact?.email.toUpperCase() === 'ADMIN';

  const conversation = selectedContact
    ? allMessages.filter(m => {
        if (isPartnerAdmin) {
          const toAdmin = m.receiverEmail?.toLowerCase() === 'admin@ictu.edu.vn' || m.receiverEmail?.toUpperCase() === 'ADMIN';
          const fromAdmin = m.senderEmail?.toLowerCase() === 'admin@ictu.edu.vn' || m.senderEmail?.toUpperCase() === 'ADMIN';
          return (m.senderEmail?.toLowerCase() === myEmail.toLowerCase() && toAdmin) ||
                 (fromAdmin && m.receiverEmail?.toLowerCase() === myEmail.toLowerCase());
        }
        return (
          (m.senderEmail?.toLowerCase() === myEmail.toLowerCase() && m.receiverEmail?.toLowerCase() === selectedContact.email.toLowerCase()) ||
          (m.senderEmail?.toLowerCase() === selectedContact.email.toLowerCase() && m.receiverEmail?.toLowerCase() === myEmail.toLowerCase())
        );
      })
    : [];

  // Lấy tin nhắn cuối cùng với từng contact
  const getLastMessage = (contactEmail: string) => {
    const isContactAdmin = contactEmail.toLowerCase() === 'admin@ictu.edu.vn' || contactEmail.toUpperCase() === 'ADMIN';
    const filtered = allMessages.filter(m => {
      if (isContactAdmin) {
        const toAdmin = m.receiverEmail?.toLowerCase() === 'admin@ictu.edu.vn' || m.receiverEmail?.toUpperCase() === 'ADMIN';
        const fromAdmin = m.senderEmail?.toLowerCase() === 'admin@ictu.edu.vn' || m.senderEmail?.toUpperCase() === 'ADMIN';
        return (m.senderEmail?.toLowerCase() === myEmail.toLowerCase() && toAdmin) ||
               (fromAdmin && m.receiverEmail?.toLowerCase() === myEmail.toLowerCase());
      }
      return (
        (m.senderEmail?.toLowerCase() === myEmail.toLowerCase() && m.receiverEmail?.toLowerCase() === contactEmail.toLowerCase()) ||
        (m.senderEmail?.toLowerCase() === contactEmail.toLowerCase() && m.receiverEmail?.toLowerCase() === myEmail.toLowerCase())
      );
    });
    if (filtered.length === 0) return null;
    return filtered[filtered.length - 1];
  };

  // Chọn contact từ danh sách hoặc từ kết quả tìm kiếm
  const handleSelectContact = (contact: ChatContact) => {
    setSelectedContact(contact);
    // Nếu contact chưa có trong danh sách contacts chính, thêm vào
    setContacts(prev => {
      if (prev.some(c => c.email.toLowerCase() === contact.email.toLowerCase())) {
        return prev;
      }
      return [contact, ...prev];
    });
    setSearchQuery('');
    setSearchResults([]);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Gửi tin nhắn
  const handleSendMessage = (e?: React.FormEvent, customText?: string) => {
    e?.preventDefault();
    const content = (customText || inputText).trim();
    if (!content || !selectedContact) return;

    const newMsg: ChatMessage = {
      id: 'chat_' + Date.now(),
      senderEmail: myEmail,
      senderName: myName,
      senderAvatar: myAvatar,
      receiverEmail: isPartnerAdmin ? 'admin@ictu.edu.vn' : selectedContact.email,
      receiverName: selectedContact.name,
      text: content,
      timestamp: new Date().toISOString(),
      isRead: false
    };

    const updated = [...allMessages, newMsg];
    setAllMessages(updated);
    setStorage('meetinghub_chats', updated);

    // Kích hoạt thông báo hệ thống
    if (isPartnerAdmin) {
      addNotification({
        title: `Tin nhắn từ ${myName}`,
        content: `${myName}: "${content}"`,
        targetRole: 'admin',
        senderRole: (currentRole || 'user') as any,
        senderName: myName,
        type: 'message'
      });
    } else {
      addNotification({
        title: `Tin nhắn từ ${myName}`,
        content: `${myName}: "${content}"`,
        targetRole: (selectedContact.role || 'all') as any,
        senderRole: (currentRole || 'user') as any,
        senderName: myName,
        type: 'message'
      });
    }

    // Phát event đồng bộ cho các tab
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('appDataSync'));

    setInputText('');
    setShowEmoji(false);
  };

  const emojis = ['👍', '👋', '🙏', '😊', '❤️', '👏', '🎯', '📚', '💡', '✅'];

  // Danh sách hiển thị ở cột trái: nếu đang tìm kiếm thì hiển thị searchResults, ngược lại hiển thị contacts
  const displayedContacts = searchQuery.trim() ? searchResults : contacts;

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm m-2 sm:m-4">
      {/* ── CỘT BÊN TRÁI: DANH SÁCH & TÌM KIẾM LIÊN HỆ ── */}
      <aside className="w-80 sm:w-96 border-r border-slate-200 bg-slate-50/50 flex flex-col shrink-0">
        {/* Header cột trái */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-sm shadow-blue-500/20">
                <MessageSquare size={19} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Tin nhắn trao đổi</h3>
                <p className="text-[11px] text-slate-500">Trao đổi với Quản trị viên & Người dùng</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              {displayedContacts.length}
            </span>
          </div>

          {/* Ô tìm kiếm người dùng theo tên hoặc email */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc email (vd: admin, @ictu)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-100 border border-transparent rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchQuery.trim() && (
            <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
              <span>{isSearching ? 'Đang tìm kiếm...' : `Kết quả tìm kiếm cho "${searchQuery}":`}</span>
              <span>{searchResults.length} người</span>
            </div>
          )}
        </div>

        {/* Danh sách người dùng */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {displayedContacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <User className="w-8 h-8 text-slate-300" />
              <span>{searchQuery.trim() ? 'Không tìm thấy người dùng phù hợp' : 'Chưa có người liên hệ nào'}</span>
              {searchQuery.trim() && (
                <span className="text-[11px] text-slate-400">Hãy thử nhập email (vd: @ictu.edu.vn) hoặc họ tên</span>
              )}
            </div>
          ) : (
            displayedContacts.map(contact => {
              const lastMsg = getLastMessage(contact.email);
              const isSelected = selectedContact?.email.toLowerCase() === contact.email.toLowerCase();
              const isAdmin = contact.isAdmin || contact.email.toLowerCase() === 'admin@ictu.edu.vn';

              return (
                <div
                  key={contact.email}
                  onClick={() => handleSelectContact(contact)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all hover:bg-slate-100/70 ${
                    isSelected ? 'bg-blue-50/90 border-r-4 border-blue-600' : ''
                  } ${isAdmin && !isSelected ? 'bg-amber-50/30' : ''}`}
                >
                  {/* Avatar + chấm online */}
                  <div className="relative shrink-0">
                    {isAdmin ? (
                      <div className="w-11 h-11 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-sky-400 shadow-xs shrink-0" title="Quản trị viên Hệ thống (Ẩn danh)">
                        <ShieldCheck size={20} />
                      </div>
                    ) : (
                      <img
                        src={resolveUserAvatar(contact)}
                        alt={contact.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=0284c7&color=fff`;
                        }}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-xs"
                      />
                    )}
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                        contact.online !== false ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  </div>

                  {/* Nội dung item */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`text-xs truncate ${isSelected ? 'font-bold text-blue-900' : 'font-semibold text-slate-800'}`}>
                          {contact.name}
                        </p>
                        {isAdmin && (
                          <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.2 rounded shadow-xs" title="Quản trị viên Hệ thống">
                            <ShieldCheck size={10} /> Admin
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(lastMsg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {contact.email}
                    </p>

                    {lastMsg ? (
                      <p className="text-[11px] text-slate-600 truncate mt-1">
                        {lastMsg.senderEmail?.toLowerCase() === myEmail.toLowerCase() ? 'Bạn: ' : ''}{lastMsg.text}
                      </p>
                    ) : (
                      <p className="text-[11px] text-blue-600 italic mt-1 font-medium">
                        {isAdmin ? '⚡ Hỗ trợ kỹ thuật & Duyệt phòng' : 'Bắt đầu trao đổi...'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── CỘT BÊN PHẢI: KHUNG CHAT CHI TIẾT ── */}
      <main className="flex-1 flex flex-col bg-slate-50/30 min-w-0">
        {selectedContact ? (
          <>
            {/* Header cuộc trò chuyện */}
            <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  {selectedContact.isAdmin || selectedContact.email.toLowerCase() === 'admin@ictu.edu.vn' ? (
                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-sky-400 shadow-xs shrink-0" title="Quản trị viên Hệ thống (Ẩn danh)">
                      <ShieldCheck size={20} />
                    </div>
                  ) : (
                    <img
                      src={resolveUserAvatar(selectedContact)}
                      alt={selectedContact.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedContact.name)}&background=0284c7&color=fff`;
                      }}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      selectedContact.online !== false ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800 text-sm truncate">
                      {selectedContact.name}
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      selectedContact.isAdmin || selectedContact.email.toLowerCase() === 'admin@ictu.edu.vn'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : selectedContact.role === 'lecturer' 
                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {selectedContact.isAdmin || selectedContact.email.toLowerCase() === 'admin@ictu.edu.vn' ? (
                        <>
                          <ShieldCheck size={11} /> Quản trị viên
                        </>
                      ) : (
                        selectedContact.roleName || (selectedContact.role === 'lecturer' ? 'Giảng viên' : 'Sinh viên')
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>Đang hoạt động</span>
                    <span className="text-slate-300">•</span>
                    <span className="truncate">{selectedContact.email}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Vùng tin nhắn */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Lời chào mở đầu cuộc trò chuyện */}
              <div className="text-center my-3">
                <div className="inline-block bg-white border border-blue-100 text-slate-700 text-xs px-5 py-3 rounded-2xl max-w-lg shadow-sm">
                  {isPartnerAdmin ? (
                    <div>
                      <p className="font-bold text-blue-700 flex items-center justify-center gap-1.5 mb-1 text-sm">
                        <ShieldCheck size={16} /> Kênh Hỗ trợ & Quản trị viên Hệ thống
                      </p>
                      <p className="text-slate-600 leading-relaxed">
                        Bạn đang trao đổi trực tiếp với <strong>Quản trị viên</strong>. Hãy gửi yêu cầu hỗ trợ kỹ thuật, duyệt phòng họp, thiết bị hoặc các thắc mắc tại đây!
                      </p>
                      {/* Gợi ý tin nhắn nhanh */}
                      <div className="flex flex-wrap gap-1.5 justify-center mt-2.5">
                        <button
                          type="button"
                          onClick={() => handleSendMessage(undefined, 'Xin chào Quản trị viên, tôi cần hỗ trợ về phòng họp.')}
                          className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200/60 hover:bg-blue-100 transition-colors"
                        >
                          💡 Cần hỗ trợ về phòng họp
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage(undefined, 'Xin chào, tôi muốn kiểm tra yêu cầu mượn thiết bị.')}
                          className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200/60 hover:bg-blue-100 transition-colors"
                        >
                          💡 Kiểm tra yêu cầu thiết bị
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage(undefined, 'Báo cáo sự cố kỹ thuật phòng họp cần xử lý gấp.')}
                          className="text-[11px] bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200/60 hover:bg-red-100 transition-colors"
                        >
                          ⚠️ Báo sự cố kỹ thuật
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-slate-800 mb-0.5">
                        💬 Cuộc trò chuyện với <strong>{selectedContact.name}</strong>
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        ({selectedContact.email} - {selectedContact.department})
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {conversation.map(msg => {
                const isMe = msg.senderEmail?.toLowerCase() === myEmail.toLowerCase();

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMe && (
                      isPartnerAdmin ? (
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-sky-400 shrink-0 mb-1 shadow-xs" title="Quản trị viên Hệ thống (Ẩn danh)">
                          <ShieldCheck size={16} />
                        </div>
                      ) : (
                        <img
                          src={resolveUserAvatar(selectedContact)}
                          alt={selectedContact.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedContact.name)}&background=0284c7&color=fff`;
                          }}
                          className="w-8 h-8 rounded-full object-cover shrink-0 mb-1 border border-slate-200 shadow-xs"
                        />
                      )
                    )}

                    <div className={`max-w-[75%] sm:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                          isMe
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-br-xs'
                            : 'bg-white text-slate-800 border border-slate-200/80 rounded-2xl rounded-bl-xs'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 px-1">
                        <span className="text-[10px] text-slate-400">
                          {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                          <span className="text-blue-500">
                            <CheckCheck size={12} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Thanh gõ tin nhắn */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 relative shrink-0">
              {/* Bảng emoji nhanh */}
              {showEmoji && (
                <div className="absolute bottom-full left-4 mb-2 p-2 bg-white rounded-xl shadow-lg border border-slate-200 flex gap-2 z-20 animate-in fade-in zoom-in-95">
                  {emojis.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setInputText(prev => prev + e)}
                      className="text-lg hover:scale-125 transition-transform p-1"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  title="Biểu tượng cảm xúc"
                >
                  <Smile size={18} />
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  placeholder={`Nhập tin nhắn trao đổi với ${selectedContact.name} (Nhấn Enter để gửi)...`}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 border border-transparent rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                    inputText.trim()
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                  title="Gửi tin nhắn"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <MessageSquare size={48} className="text-slate-300 mb-3 stroke-[1.5]" />
            <h4 className="font-bold text-slate-700 text-base">Chưa chọn cuộc trò chuyện</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Vui lòng chọn Quản trị viên hoặc tìm kiếm một người dùng ở danh sách bên trái để bắt đầu nhắn tin trao đổi.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
