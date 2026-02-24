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
      navigate('/feed'); // In a real app, we'd go to the specific post
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_user': return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'new_post': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'like': return <CheckCircle className="w-5 h-5 text-red-500" />;
      case 'comment': return <MessageSquare className="w-5 h-5 text-purple-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="p-4 border-b sticky top-0 bg-white z-10 flex items-center gap-2">
        <Bell className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold">Notifications</h1>
      </div>

      <div className="divide-y">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`p-4 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${!notif.is_read ? 'bg-blue-50' : ''}`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-200">
                {notif.sender_avatar ? (
                  <img src={notif.sender_avatar} alt={notif.sender_username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                    {notif.sender_username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getIcon(notif.type)}
                  <span className="font-semibold text-sm flex items-center gap-1">
                    <VerifiedBadge username={notif.sender_username} isVerified={notif.sender_verified} className="w-3 h-3 bg-blue-500 text-white rounded-full font-bold text-[8px]" />
                    {notif.sender_username}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{notif.content}</p>
                <span className="text-xs text-gray-500 mt-1 block">
                  {new Date(notif.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-10 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
