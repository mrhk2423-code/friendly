import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, User as UserIcon } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { supabase } from '@/lib/supabase';

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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', authUser?.id)
        .limit(50);
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-4">
      <h2 className="text-2xl font-bold px-2">People You May Know</h2>
      <div className="space-y-2">
        {users.map((user) => (
          <Card 
            key={user.id} 
            className="hover:bg-gray-50 cursor-pointer transition-colors border-none shadow-sm"
            onClick={() => navigate(`/users/${user.id}`)}
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden border border-gray-100 flex-shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-500">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-bold text-gray-900 flex items-center gap-1">
                    <VerifiedBadge username={user.username} isVerified={user.is_verified} />
                    {user.username}
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-[180px]">{user.bio || 'No bio yet'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/users/${user.id}`);
                  }}
                >
                  Profile
                </Button>
                <Button 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700 rounded-full gap-1"
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
          <div className="text-center text-gray-500 py-10">No other users found.</div>
        )}
      </div>
    </div>
  );
}
