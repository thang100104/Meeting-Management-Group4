import React, { useState, useEffect } from 'react';
import {
  Mail, Calendar, Clock, MapPin, Users, Video, CheckCircle2,
  XCircle, AlertCircle, ExternalLink, QrCode, Search, RefreshCw, X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

interface StudentInvitationsProps {
  userProfile?: any;
}

export default function StudentInvitations({ userProfile }: StudentInvitationsProps) {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQrMeeting, setSelectedQrMeeting] = useState<any | null>(null);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  const currentUserId = userProfile?.id || userProfile?.user_id;

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/meetings');
      if (Array.isArray(res.data)) {
        // Lọc các cuộc họp mà sinh viên hiện tại có trong danh sách participants
        const invited = res.data.filter((m: any) =>
          m.participants && m.participants.some((p: any) =>
            p.user_id === currentUserId ||
            (userProfile?.email && p.user?.email && p.user.email.toLowerCase() === userProfile.email.toLowerCase())
          )
        );
        setMeetings(invited);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách lời mời:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
    window.addEventListener('meeting-updated', loadInvitations);
    window.addEventListener('storage', loadInvitations);
    return () => {
      window.removeEventListener('meeting-updated', loadInvitations);
      window.removeEventListener('storage', loadInvitations);
    };
  }, [currentUserId]);

  const handleRespond = async (meetingId: number, status: 'ACCEPTED' | 'DECLINED') => {
    setRespondingId(meetingId);
    try {
      await api.patch(`/meetings/${meetingId}/respond`, { status });
      // Cập nhật trạng thái local
      setMeetings(prev =>
        prev.map(m => {
          if (m.meeting_id !== meetingId) return m;
          return {
            ...m,
            participants: m.participants.map((p: any) =>
              (p.user_id === currentUserId || (userProfile?.email && p.user?.email === userProfile.email))
                ? { ...p, rsvp_status: status }
                : p
            )
          };
        })
      );
      window.dispatchEvent(new Event('meeting-updated'));
      window.dispatchEvent(new Event('storage'));
      alert(status === 'ACCEPTED' ? '🎉 Bạn đã xác nhận THAM GIA cuộc họp!' : 'Đã từ chối lời mời.');
    } catch (err: any) {
      console.error('Lỗi khi phản hồi lời mời:', err);
      alert(err.response?.data?.detail || 'Không thể gửi phản hồi. Vui lòng thử lại!');
    } finally {
      setRespondingId(null);
    }
  };

  // Helper lấy RSVP của user hiện tại trong meeting
  const getMyRsvpStatus = (meeting: any): string => {
    const p = meeting.participants?.find((part: any) =>
      part.user_id === currentUserId ||
      (userProfile?.email && part.user?.email && part.user.email.toLowerCase() === userProfile.email.toLowerCase())
    );
    return p?.rsvp_status || 'PENDING';
  };

  // Filter
  const filteredMeetings = meetings.filter(m => {
    const rsvp = getMyRsvpStatus(m);
    if (filterTab === 'PENDING' && rsvp !== 'PENDING') return false;
    if (filterTab === 'ACCEPTED' && rsvp !== 'ACCEPTED') return false;
    if (filterTab === 'DECLINED' && rsvp !== 'DECLINED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title?.toLowerCase().includes(q);
      const matchOrg = m.organizer?.full_name?.toLowerCase().includes(q);
      const matchRoom = m.room?.room_name?.toLowerCase().includes(q);
      return matchTitle || matchOrg || matchRoom;
    }
    return true;
  });

  const pendingCount = meetings.filter(m => getMyRsvpStatus(m) === 'PENDING').length;
  const acceptedCount = meetings.filter(m => getMyRsvpStatus(m) === 'ACCEPTED').length;
  const declinedCount = meetings.filter(m => getMyRsvpStatus(m) === 'DECLINED').length;

  return (
    <div style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail size={26} color="#3b82f6" />
            Lời Mời Tham Gia Cuộc Họp
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            Danh sách các cuộc họp, hội thảo bạn được Giảng viên hoặc Nhà trường mời tham dự.
          </p>
        </div>

        <button
          onClick={loadInvitations}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            color: '#334155',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
          className="hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
          Làm mới
        </button>
      </div>

      {/* Tabs & Search Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'ALL', label: 'Tất cả', count: meetings.length },
            { id: 'PENDING', label: 'Chờ phản hồi', count: pendingCount, highlight: true },
            { id: 'ACCEPTED', label: 'Đã xác nhận', count: acceptedCount },
            { id: 'DECLINED', label: 'Đã từ chối', count: declinedCount }
          ].map(tab => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: active ? '#1e293b' : '#f1f5f9',
                  color: active ? '#ffffff' : '#475569',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  padding: '2px 7px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  backgroundColor: active ? 'rgba(255,255,255,0.2)' : (tab.highlight && tab.count > 0 ? '#fef3c7' : '#e2e8f0'),
                  color: active ? '#ffffff' : (tab.highlight && tab.count > 0 ? '#b45309' : '#64748b')
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: '280px' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Tìm theo tên cuộc họp, giảng viên, phòng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Danh sách lời mời */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={32} className="animate-spin text-blue-500" style={{ margin: '0 auto 12px auto' }} />
          <div>Đang tải danh sách lời mời...</div>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
          <Mail size={48} color="#94a3b8" style={{ margin: '0 auto 16px auto', opacity: 0.6 }} />
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 6px 0' }}>
            Không có lời mời nào
          </h4>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            {filterTab === 'PENDING'
              ? 'Tuyệt vời! Bạn không còn lời mời nào đang chờ phản hồi.'
              : 'Hiện chưa có cuộc họp nào phù hợp với bộ lọc.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredMeetings.map(meeting => {
            const st = new Date(meeting.start_time);
            const et = new Date(meeting.end_time);
            const rsvp = getMyRsvpStatus(meeting);
            const isResponding = respondingId === meeting.meeting_id;

            return (
              <div
                key={meeting.meeting_id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                className="hover:shadow-md hover:border-slate-300"
              >
                {/* Top Badge: Meeting Type + RSVP Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: meeting.meeting_type === 'ONLINE' ? '#e0f2fe' : meeting.meeting_type === 'HYBRID' ? '#f3e8ff' : '#f0fdf4',
                    color: meeting.meeting_type === 'ONLINE' ? '#0369a1' : meeting.meeting_type === 'HYBRID' ? '#7e22ce' : '#15803d'
                  }}>
                    {meeting.meeting_type === 'ONLINE' ? '💻 Google Meet' : meeting.meeting_type === 'HYBRID' ? '🌐 Hybrid' : '🏢 Trực tiếp'}
                  </span>

                  {/* Status Badge */}
                  {rsvp === 'ACCEPTED' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#16a34a', backgroundColor: '#f0fdf4', padding: '4px 10px', borderRadius: '999px', border: '1px solid #bbf7d0' }}>
                      <CheckCircle2 size={14} /> Đã đồng ý
                    </span>
                  ) : rsvp === 'DECLINED' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#dc2626', backgroundColor: '#fef2f2', padding: '4px 10px', borderRadius: '999px', border: '1px solid #fecaca' }}>
                      <XCircle size={14} /> Đã từ chối
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#b45309', backgroundColor: '#fef3c7', padding: '4px 10px', borderRadius: '999px', border: '1px solid #fde68a' }}>
                      <AlertCircle size={14} /> Chờ bạn phản hồi
                    </span>
                  )}
                </div>

                {/* Tiêu đề & Người mời */}
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                    {meeting.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                    <Users size={14} color="#64748b" />
                    <span>Người tổ chức: </span>
                    <strong style={{ color: '#334155' }}>{meeting.organizer?.full_name || 'Giảng viên'}</strong>
                  </div>
                </div>

                {/* Thời gian & Địa điểm */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                    <Calendar size={15} color="#2563eb" />
                    <span>{st.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                    <Clock size={15} color="#2563eb" />
                    <span>
                      {st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {et.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                    <MapPin size={15} color="#2563eb" />
                    <span>{meeting.room?.room_name || `Phòng họp ${meeting.room_id}`} ({meeting.room?.location || 'Tòa C1'})</span>
                  </div>
                </div>

                {/* Link Meet nếu có */}
                {meeting.meeting_link && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f0fdfa', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#0f766e', fontWeight: '600' }}>
                      <Video size={16} />
                      <span>Google Meet</span>
                    </div>
                    <a
                      href={meeting.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#0d9488', fontWeight: 'bold', textDecoration: 'none' }}
                      className="hover:underline"
                    >
                      Tham gia <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  {rsvp !== 'ACCEPTED' ? (
                    <button
                      onClick={() => handleRespond(meeting.meeting_id, 'ACCEPTED')}
                      disabled={isResponding}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: isResponding ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      className="hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle2 size={16} />
                      {isResponding ? 'Đang gửi...' : 'Đồng ý tham gia'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedQrMeeting(meeting)}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      className="hover:bg-blue-100 transition-colors"
                    >
                      <QrCode size={16} />
                      Xem QR điểm danh
                    </button>
                  )}

                  {rsvp !== 'DECLINED' && (
                    <button
                      onClick={() => handleRespond(meeting.meeting_id, 'DECLINED')}
                      disabled={isResponding}
                      style={{
                        padding: '9px 14px',
                        backgroundColor: '#ffffff',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: isResponding ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      className="hover:bg-red-50 transition-colors"
                    >
                      <XCircle size={15} />
                      Từ chối
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* QR MODAL */}
      {selectedQrMeeting && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '380px', padding: '24px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f1f1f', margin: 0 }}>Mã QR Điểm Danh</h3>
              <button onClick={() => setSelectedQrMeeting(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Cuộc họp: <strong style={{ color: '#0f172a' }}>{selectedQrMeeting.title}</strong>
            </p>

            <div style={{ display: 'inline-block', padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <QRCodeSVG
                value={`MEETING_CHECKIN_${selectedQrMeeting.meeting_id}_${selectedQrMeeting.qr_token || 'TOKEN'}_USER_${currentUserId}`}
                size={200}
                level="H"
              />
            </div>

            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => setSelectedQrMeeting(null)}
                style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
