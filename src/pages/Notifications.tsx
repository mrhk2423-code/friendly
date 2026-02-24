import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserPlus, MessageSquare, FileText, CheckCircle } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface Notification {
  id: number;
  type: 'new_user' | 'new_post' | 'like' | 'comment';
  sender_id: number;
  post_id?: number;
  content: string;
  is_read: boolean;
  created_at: string;
  sender_username: string;
  sender_avatar: string;
  sender_verified?: number;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    markAsRead();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'POST' });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (notif.type === 'new_user') {
      navigate(`/users/${notif.sender_id}`);
    } else if (notif.type === 'new_post' || notif.type === 'like' || notif.type === 'comment') {
      navigate(`/feed?postId=${notif.post_id}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_user': return <UserPlus className="w-5 h-5 text-emerald-500" />;
      case 'new_post': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'like': return <CheckCircle className="w-5 h-5 text-rose-500" />;
      case 'comment': return <MessageSquare className="w-5 h-5 text-amber-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen">
      <div className="p-4 border-b border-white/5 sticky top-0 glass z-10 flex items-center gap-3">
        <Bell className="w-6 h-6 text-accent" />
        <h1 className="text-xl font-display font-bold text-white">Notifications</h1>
      </div>

      <div className="divide-y divide-white/5">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`p-5 flex gap-4 cursor-pointer transition-all duration-300 ${!notif.is_read ? 'bg-accent/5 border-l-4 border-accent' : 'hover:bg-white/5'}`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div className="w-14 h-14 rounded-full bg-white/5 overflow-hidden flex-shrink-0 border border-white/10">
                {notif.sender_avatar ? (
                  <img src={notif.sender_avatar} alt={notif.sender_username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg">
                    {notif.sender_username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  {getIcon(notif.type)}
                  <span className="font-bold text-gray-200 flex items-center gap-1">
                    <VerifiedBadge username={notif.sender_username} isVerified={notif.sender_verified} />
                    {notif.sender_username}
                  </span>
                </div>
                <p className="text-[15px] text-gray-300 leading-relaxed">{notif.content}</p>
                <span className="text-xs text-gray-500 mt-2 block font-medium">
                  {new Date(notif.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-20 text-center text-gray-500">
            <Bell className="w-16 h-16 mx-auto mb-6 opacity-10" />
            <p className="text-lg font-medium">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
