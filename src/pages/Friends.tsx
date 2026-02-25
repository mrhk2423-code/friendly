import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, User as UserIcon } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface User {
  id: string;
  username: string;
  avatar_url: string;
  bio: string;
  is_verified?: number;
}

export default function Friends() {
  const [users, setUsers] = useState<User[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      <h2 className="text-2xl font-display font-bold px-2 text-white">People You May Know</h2>
      <div className="space-y-3">
        {users.map((user) => (
          <Card 
            key={user.id} 
            className="glass border-white/10 hover:bg-white/5 cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden"
            onClick={() => navigate(`/users/${user.id}`)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 overflow-hidden border border-white/10 flex-shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-bold text-gray-200 flex items-center gap-1 text-lg">
                    <VerifiedBadge username={user.username} isVerified={user.is_verified} />
                    {user.username}
                  </div>
                  <div className="text-sm text-gray-400 truncate max-w-[200px]">{user.bio || 'No bio yet'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/users/${user.id}`);
                  }}
                >
                  Profile
                </Button>
                <Button 
                  size="sm" 
                  className="bg-accent hover:bg-accent/90 text-white rounded-full gap-2 font-semibold"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/chat?userId=${user.id}`);
                  }}
                >
                  <MessageCircle className="w-4 h-4" /> Chat
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {users.length === 0 && (
          <div className="text-center text-gray-500 py-20 glass rounded-2xl border-white/10">
            <UserIcon className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="text-lg font-medium">No other users found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
