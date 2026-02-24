import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, 
  Search, 
  MessageCircle, 
  Plus, 
  Home, 
  Tv, 
  Users, 
  Store, 
  Bell, 
  ArrowLeft,
  LogOut
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<{username: string, avatar_url: string} | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isChat = location.pathname.startsWith('/chat');
  const showBack = location.pathname !== '/feed' && location.pathname !== '/login' && location.pathname !== '/register';

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-20 font-sans">
      {/* Top Header */}
      <div className="bg-white sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-md mx-auto flex justify-between items-center px-4 py-3">
          <div className="flex items-center gap-3">
            {showBack ? (
              <div 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </div>
            ) : (
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50">
                <Menu className="w-5 h-5 text-blue-600" />
              </div>
            )}
            <h1 
              className="text-xl font-extrabold text-blue-600 tracking-tighter cursor-pointer select-none" 
              onClick={() => navigate('/feed')}
            >
              friendly
            </h1>
          </div>
          <div className="flex gap-2">
            <div 
              className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => navigate('/feed')}
            >
              <Plus className="w-5 h-5 text-gray-700" />
            </div>
            <div 
              className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => navigate('/search')}
            >
              <Search className="w-5 h-5 text-gray-700" />
            </div>
            <div 
              className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors ${isChat ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
              onClick={() => navigate('/chat')}
            >
              <MessageCircle className="w-5 h-5" />
            </div>
            <div 
              className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-100 transition-colors"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-md mx-auto flex justify-between px-2">
          <NavItem 
            icon={<Home className="w-5 h-5" />} 
            active={location.pathname === '/feed'} 
            onClick={() => navigate('/feed')} 
          />
          <NavItem 
            icon={<Tv className="w-5 h-5" />} 
            active={location.pathname === '/videos'} 
            onClick={() => navigate('/videos')} 
          />
          <NavItem 
            icon={<Users className="w-5 h-5" />} 
            active={location.pathname === '/friends'} 
            onClick={() => navigate('/friends')} 
          />
          <NavItem 
            icon={<Bell className="w-5 h-5" />} 
            active={location.pathname === '/notifications'} 
            onClick={() => navigate('/notifications')} 
          />
          <div 
            className="flex-1 flex justify-center py-3 cursor-pointer group"
            onClick={() => navigate('/profile')}
          >
            <div className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-all ${location.pathname === '/profile' ? 'border-blue-600 scale-110' : 'border-transparent group-hover:border-gray-300'}`}>
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                  {currentUser?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {children}
      </div>
    </div>
  );
}

function NavItem({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <div 
      className={`flex-1 flex justify-center py-3 cursor-pointer transition-all relative group`}
      onClick={onClick}
    >
      <div className={`${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
        {icon}
      </div>
      {active && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
      )}
    </div>
  );
}
