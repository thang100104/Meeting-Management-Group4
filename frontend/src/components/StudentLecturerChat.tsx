import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Search, User, MessageSquare, CheckCheck, Clock, 
  Smile, Paperclip, Image as ImageIcon, Circle, ChevronRight,
  GraduationCap, BookOpen, ShieldAlert
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
  role: 'lecturer' | 'student';
  department?: string;
  avatar?: string;
  online?: boolean;
}

// Danh sách giảng viên mặc định chuẩn bị sẵn
const DEFAULT_LECTURERS: ChatContact[] = [
  {
    id: 1,
    name: 'GV. Nguyễn Phương',
    fullName: 'Nguyễn Phương',
    email: 'nguyenphuong@ictu.edu.vn',
    role: 'lecturer',
    department: 'Khoa Công nghệ Thông tin',
    avatar: 'https://ui-avatars.com/api/?name=Nguyen+Phuong&background=0284c7&color=fff',
    online: true
  },
  {
    id: 2,
    name: 'ThS. Hoàng Thanh Phương',
    fullName: 'Hoàng Thanh Phương',
    email: 'hoangphuong@ictu.edu.vn',
    role: 'lecturer',
    department: 'Bộ môn Kỹ thuật Phần mềm',
    avatar: 'https://ui-avatars.com/api/?name=Hoang+Phuong&background=2563eb&color=fff',
    online: true
  },
  {
    id: 3,
    name: 'ThS. Trần Thị B',
    fullName: 'Trần Thị B',
    email: 'tranthib@ictu.edu.vn',
    role: 'lecturer',
    department: 'Phòng Đào Tạo & QLKH',
    avatar: 'https://ui-avatars.com/api/?name=Tran+Thi+B&background=7c3aed&color=fff',
    online: false
  }
];

// Danh sách sinh viên mẫu trong hệ thống (chỉ giữ tài khoản sinh viên thực tế nếu cần fallback)
const DEFAULT_STUDENTS: ChatContact[] = [
  {
    id: 101,
    name: 'Sinh viên Trần Linh',
    fullName: 'Trần Linh',
    email: 'tranlinh@ictu.edu.vn',
    role: 'student',
    department: 'Khoa Công nghệ Thông tin',
    avatar: 'https://ui-avatars.com/api/?name=Tran+Linh&background=10b981&color=fff',
    online: true
  }
];

// Tin nhắn khởi tạo ban đầu giữa SV và GV nếu chưa có
const INITIAL_DEMO_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_seed_1',
    senderEmail: 'tranlinh@ictu.edu.vn',
    senderName: 'Sinh viên Trần Linh',
    receiverEmail: 'nguyenphuong@ictu.edu.vn',
    receiverName: 'GV. Nguyễn Phương',
    text: 'Thưa thầy, cho em hỏi tài liệu buổi họp báo cáo tiến độ tuần này đã được đăng tải chưa ạ?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    isRead: true
  },
  {
    id: 'msg_seed_2',
    senderEmail: 'nguyenphuong@ictu.edu.vn',
    senderName: 'GV. Nguyễn Phương',
    receiverEmail: 'tranlinh@ictu.edu.vn',
    receiverName: 'Sinh viên Trần Linh',
    text: 'Chào em, thầy đã gửi vào hòm thư lớp và đính kèm trên hệ thống rồi nhé. Các em chuẩn bị slide thật kỹ nha!',
    timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    isRead: true
  }
];

interface StudentLecturerChatProps {
  currentRole: 'student' | 'lecturer';
  userProfile: any;
}

export default function StudentLecturerChat({ currentRole, userProfile }: StudentLecturerChatProps) {
  const myEmail = userProfile?.email || (currentRole === 'student' ? 'tranlinh@ictu.edu.vn' : 'nguyenphuong@ictu.edu.vn');
  const myName = userProfile?.fullName || userProfile?.name || (currentRole === 'student' ? 'Sinh viên' : 'Giảng viên');
  const myAvatar = userProfile?.avatar || userProfile?.avatarUrl;

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() => {
    let saved = getStorage<ChatMessage[]>('meetinghub_chats', []);
    // Dọn dẹp bỏ các tin nhắn mẫu của sinh viên D và E nếu từng lưu
    if (Array.isArray(saved) && saved.length > 0) {
      saved = saved.filter(
        m => m.senderEmail !== 'sinhvien_d@ictu.edu.vn' &&
             m.receiverEmail !== 'sinhvien_d@ictu.edu.vn' &&
             m.senderEmail !== 'sinhvien_e@ictu.edu.vn' &&
             m.receiverEmail !== 'sinhvien_e@ictu.edu.vn'
      );
      setStorage('meetinghub_chats', saved);
      return saved;
    }
    setStorage('meetinghub_chats', INITIAL_DEMO_MESSAGES);
    return INITIAL_DEMO_MESSAGES;
  });
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Tải danh sách liên hệ theo vai trò
  useEffect(() => {
    const fetchContacts = async () => {
      if (currentRole === 'student') {
        // Sinh viên chat với Giảng viên -> Cần danh sách các Giảng viên
        try {
          const res = await api.get('/users/lecturers');
          if (Array.isArray(res.data) && res.data.length > 0) {
            const mapped: ChatContact[] = res.data.map(u => ({
              id: u.id || u.user_id,
              name: u.full_name?.startsWith('GV') || u.full_name?.startsWith('ThS') ? u.full_name : `GV. ${u.full_name}`,
              fullName: u.full_name,
              email: u.email,
              role: 'lecturer',
              department: u.department || 'Khoa Công nghệ Thông tin',
              avatar: u.avatar,
              online: true
            }));
            setContacts(mapped);
            if (!selectedContact && mapped.length > 0) {
              setSelectedContact(mapped[0]);
            }
            return;
          }
        } catch (e) {
          console.warn('Using default lecturers fallback', e);
        }
        setContacts(DEFAULT_LECTURERS);
        if (!selectedContact && DEFAULT_LECTURERS.length > 0) {
          setSelectedContact(DEFAULT_LECTURERS[0]);
        }
      } else {
        // Giảng viên chat với Sinh viên -> Lấy danh sách Sinh viên thật từ API backend
        let studentList: ChatContact[] = [];

        try {
          const res = await api.get('/users/students');
          if (Array.isArray(res.data) && res.data.length > 0) {
            studentList = res.data
              .filter(u => u.email !== 'sinhvien_d@ictu.edu.vn' && u.email !== 'sinhvien_e@ictu.edu.vn')
              .map(u => ({
                id: u.id || u.user_id,
                name: u.full_name?.startsWith('SV') ? u.full_name : `SV. ${u.full_name}`,
                fullName: u.full_name,
                email: u.email,
                role: 'student',
                department: u.department || 'Sinh viên',
                avatar: u.avatar || `https://ui-avatars.com/api/?name=${u.full_name}&background=10b981&color=fff`,
                online: true
              }));
          }
        } catch (e) {
          console.warn('Cannot fetch students from API, using active chat records', e);
        }

        // Nếu backend chưa có hoặc rỗng, dùng DEFAULT_STUDENTS (đã lọc sạch D & E)
        if (studentList.length === 0) {
          studentList = [...DEFAULT_STUDENTS];
        }

        // Bổ sung các sinh viên từng gửi tin nhắn tới giảng viên này
        const chats = getStorage<ChatMessage[]>('meetinghub_chats', []).filter(
          m => m.senderEmail !== 'sinhvien_d@ictu.edu.vn' &&
               m.receiverEmail !== 'sinhvien_d@ictu.edu.vn' &&
               m.senderEmail !== 'sinhvien_e@ictu.edu.vn' &&
               m.receiverEmail !== 'sinhvien_e@ictu.edu.vn'
        );

        const studentEmails = new Set<string>();
        chats.forEach(m => {
          if (m.receiverEmail === myEmail && m.senderEmail !== myEmail && m.senderEmail !== 'ADMIN') {
            studentEmails.add(m.senderEmail);
          }
          if (m.senderEmail === myEmail && m.receiverEmail !== 'ADMIN') {
            studentEmails.add(m.receiverEmail);
          }
        });

        studentEmails.forEach(email => {
          if (!studentList.some(s => s.email === email)) {
            const sampleMsg = chats.find(m => m.senderEmail === email);
            studentList.unshift({
              id: 'stu_' + email,
              name: sampleMsg?.senderName || email.split('@')[0],
              fullName: sampleMsg?.senderName || email.split('@')[0],
              email: email,
              role: 'student',
              department: 'Sinh viên',
              avatar: sampleMsg?.senderAvatar || `https://ui-avatars.com/api/?name=${email}&background=10b981&color=fff`,
              online: true
            });
          }
        });

        // Loại bỏ triệt để mọi tài khoản D và E nếu còn sót
        studentList = studentList.filter(
          s => s.email !== 'sinhvien_d@ictu.edu.vn' && s.email !== 'sinhvien_e@ictu.edu.vn'
        );

        setContacts(studentList);
        if (!selectedContact && studentList.length > 0) {
          setSelectedContact(studentList[0]);
        }
      }
    };

    fetchContacts();
  }, [currentRole, myEmail]);

  // 2. Lắng nghe cập nhật tin nhắn real-time
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
  const conversation = selectedContact
    ? allMessages.filter(
        m =>
          (m.senderEmail === myEmail && m.receiverEmail === selectedContact.email) ||
          (m.senderEmail === selectedContact.email && m.receiverEmail === myEmail)
      )
    : [];

  // Lấy tin nhắn cuối cùng với từng contact
  const getLastMessage = (contactEmail: string) => {
    const filtered = allMessages.filter(
      m =>
        (m.senderEmail === myEmail && m.receiverEmail === contactEmail) ||
        (m.senderEmail === contactEmail && m.receiverEmail === myEmail)
    );
    if (filtered.length === 0) return null;
    return filtered[filtered.length - 1];
  };

  // Gửi tin nhắn
  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedContact) return;

    const newMsg: ChatMessage = {
      id: 'chat_' + Date.now(),
      senderEmail: myEmail,
      senderName: myName,
      senderAvatar: myAvatar,
      receiverEmail: selectedContact.email,
      receiverName: selectedContact.name,
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
      isRead: false
    };

    const updated = [...allMessages, newMsg];
    setAllMessages(updated);
    setStorage('meetinghub_chats', updated);

    // Bắn thông báo cho đối phương
    if (currentRole === 'student') {
      // Sinh viên nhắn -> Báo cho Giảng viên
      addNotification({
        title: `Tin nhắn từ Sinh viên ${myName}`,
        content: `Sinh viên ${myName}: "${inputText.trim()}"`,
        targetRole: 'lecturer',
        senderRole: 'student',
        senderName: myName,
        type: 'message'
      });
    } else {
      // Giảng viên trả lời -> Báo cho Sinh viên
      addNotification({
        title: `Tin nhắn từ ${myName}`,
        content: `${myName}: "${inputText.trim()}"`,
        targetRole: 'student',
        senderRole: 'lecturer',
        senderName: myName,
        type: 'message'
      });
    }

    setInputText('');
    setShowEmoji(false);
  };

  // Danh sách đã lọc theo ô tìm kiếm
  const filteredContacts = contacts.filter(
    c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.department && c.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const emojis = ['👍', '👋', '🙏', '😊', '❤️', '👏', '🎯', '📚', '💡', '✅'];

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm m-2 sm:m-4">
      {/* ── CỘT BÊN TRÁI: DANH SÁCH NGƯỜI LIÊN HỆ ── */}
      <aside className="w-80 sm:w-96 border-r border-slate-200 bg-slate-50/50 flex flex-col shrink-0">
        {/* Header cột trái */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                currentRole === 'student' ? 'bg-blue-600' : 'bg-emerald-600'
              }`}>
                {currentRole === 'student' ? <GraduationCap size={18} /> : <BookOpen size={18} />}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {currentRole === 'student' ? 'Giảng viên hướng dẫn' : 'Tin nhắn Sinh viên'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {currentRole === 'student' ? 'Chọn giảng viên để trao đổi' : 'Danh sách sinh viên liên hệ'}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredContacts.length}
            </span>
          </div>

          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder={currentRole === 'student' ? 'Tìm tên giảng viên, khoa...' : 'Tìm tên sinh viên, lớp...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-100 border-none rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Danh sách người dùng */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <User className="w-8 h-8 text-slate-300" />
              <span>Không tìm thấy người liên hệ phù hợp</span>
            </div>
          ) : (
            filteredContacts.map(contact => {
              const lastMsg = getLastMessage(contact.email);
              const isSelected = selectedContact?.email === contact.email;

              return (
                <div
                  key={contact.email}
                  onClick={() => setSelectedContact(contact)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all hover:bg-slate-100/70 ${
                    isSelected ? 'bg-blue-50/80 border-r-4 border-blue-600' : ''
                  }`}
                >
                  {/* Avatar + chấm online */}
                  <div className="relative shrink-0">
                    <img
                      src={contact.avatar || `https://ui-avatars.com/api/?name=${contact.name}&background=random`}
                      alt={contact.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                        contact.online !== false ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  </div>

                  {/* Nội dung item */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${isSelected ? 'font-bold text-blue-900' : 'font-semibold text-slate-800'}`}>
                        {contact.name}
                      </p>
                      {lastMsg && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(lastMsg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {contact.department}
                    </p>

                    {lastMsg ? (
                      <p className="text-[11px] text-slate-600 truncate mt-1">
                        {lastMsg.senderEmail === myEmail ? 'Bạn: ' : ''}{lastMsg.text}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic mt-1">
                        Chưa có tin nhắn
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
            <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={selectedContact.avatar || `https://ui-avatars.com/api/?name=${selectedContact.name}&background=random`}
                    alt={selectedContact.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
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
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      selectedContact.role === 'lecturer' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {selectedContact.role === 'lecturer' ? 'Giảng viên' : 'Sinh viên'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>Đang hoạt động</span>
                    <span className="text-slate-300">•</span>
                    <span className="truncate">{selectedContact.department}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Vùng tin nhắn */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Tin nhắn thông báo mở đầu */}
              <div className="text-center my-4">
                <div className="inline-block bg-blue-50 border border-blue-100 text-blue-800 text-xs px-4 py-2 rounded-2xl max-w-md shadow-sm">
                  {currentRole === 'student' ? (
                    <span>
                      👋 Bạn đang trao đổi trực tiếp với <strong>{selectedContact.name}</strong>. Hãy nhắn câu hỏi, xin tài liệu hoặc các vấn đề học tập/lịch họp tại đây!
                    </span>
                  ) : (
                    <span>
                      💬 Kênh trao đổi trực tiếp với <strong>{selectedContact.name}</strong>. Mọi phản hồi của Thầy/Cô sẽ được gửi ngay đến sinh viên.
                    </span>
                  )}
                </div>
              </div>

              {conversation.map(msg => {
                const isMe = msg.senderEmail === myEmail;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMe && (
                      <img
                        src={selectedContact.avatar || `https://ui-avatars.com/api/?name=${selectedContact.name}&background=random`}
                        alt={selectedContact.name}
                        className="w-7 h-7 rounded-full object-cover shrink-0 mb-1 border border-slate-200"
                      />
                    )}

                    <div className={`max-w-[75%] sm:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                          isMe
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-br-sm'
                            : 'bg-white text-slate-800 border border-slate-200/80 rounded-2xl rounded-bl-sm'
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
                  type="text"
                  placeholder={
                    currentRole === 'student'
                      ? `Nhập nội dung nhắn cho ${selectedContact.name}...`
                      : `Nhập nội dung trả lời ${selectedContact.name}...`
                  }
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 border-none rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                    inputText.trim()
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700'
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
              {currentRole === 'student'
                ? 'Vui lòng chọn một thầy/cô ở danh sách bên trái để bắt đầu trao đổi.'
                : 'Vui lòng chọn một sinh viên ở danh sách bên trái để xem và trả lời tin nhắn.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
