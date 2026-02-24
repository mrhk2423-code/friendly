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
    <div className="container mx-auto p-4 max-w-2xl space-y-4">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input 
          autoFocus
          placeholder="Search for people..." 
          className="pl-10 h-12 rounded-full bg-white shadow-sm border-gray-200 focus-visible:ring-blue-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {results.map((user) => (
          <Card 
            key={user.id} 
            className="hover:bg-gray-50 cursor-pointer transition-colors border-none shadow-sm"
            onClick={() => navigate(`/users/${user.id}`)}
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden border border-gray-100 flex-shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-500">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-1">
                    <VerifiedBadge username={user.username} isVerified={user.is_verified} />
                    {user.username}
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-[200px]">{user.bio || 'No bio yet'}</div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/chat?userId=${user.id}`);
                }}
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {query && results.length === 0 && (
          <div className="text-center text-gray-500 py-10">No users found for "{query}"</div>
        )}
      </div>
    </div>
  );
}
