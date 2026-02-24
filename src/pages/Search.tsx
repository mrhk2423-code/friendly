import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search as SearchIcon, MessageCircle } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface User {
  id: number;
  username: string;
  avatar_url: string;
  bio: string;
  is_verified?: number;
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        fetchResults();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
        <Input 
          autoFocus
          placeholder="Search for people..." 
          className="pl-12 h-14 rounded-2xl glass border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-accent focus-visible:border-accent"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {results.map((user) => (
          <Card 
            key={user.id} 
            className="glass-hover cursor-pointer border-white/10 shadow-xl rounded-2xl overflow-hidden"
            onClick={() => navigate(`/users/${user.id}`)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/5 overflow-hidden border border-white/10 flex-shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-1 text-lg">
                    <VerifiedBadge username={user.username} isVerified={user.is_verified} />
                    {user.username}
                  </div>
                  <div className="text-sm text-gray-400 truncate max-w-[200px]">{user.bio || 'No bio yet'}</div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-accent hover:bg-accent/10 hover:text-accent rounded-full w-12 h-12"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/chat?userId=${user.id}`);
                }}
              >
                <MessageCircle className="w-6 h-6" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {query && results.length === 0 && (
          <div className="text-center text-gray-500 py-16 glass rounded-2xl border-white/10">No users found for "{query}"</div>
        )}
      </div>
    </div>
  );
}
