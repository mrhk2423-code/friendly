import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, ThumbsUp, Share2 } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface User {
  id: number;
  username: string;
  avatar_url: string;
  bio: string;
  is_verified?: number;
}

interface Post {
  id: number;
  content: string;
  created_at: string;
  username: string;
  avatar_url: string;
  likes_count: number;
  comments_count: number;
  is_liked: number;
  media_url?: string;
  media_type?: 'text' | 'image' | 'video' | 'audio';
  is_verified?: number;
}

export default function UserProfile() {
  const { id } = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCurrentUser();
    if (id) {
      fetchUser();
      fetchPosts();
    }
  }, [id]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const handleToggleVerify = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/users/${user.id}/verify`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setUser({ ...user, is_verified: data.is_verified });
      }
    } catch (error) {
      console.error('Error toggling verification:', error);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch(`/api/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch(`/api/users/${id}/posts`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <div className="p-8 text-center">User not found.</div>;

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden border-4 border-white shadow-lg">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-4xl font-bold bg-gray-300">
                  {user.username[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                <VerifiedBadge username={user.username} isVerified={user.is_verified} className="w-6 h-6 bg-blue-500 text-white rounded-full font-bold text-[14px]" />
                {user.username}
              </h2>
              <p className="text-gray-600 mt-2">{user.bio || 'No bio yet.'}</p>
            </div>
            
            <div className="flex flex-col w-full gap-2">
              <Button 
                onClick={() => navigate(`/chat?userId=${user.id}`)} 
                className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <MessageCircle className="w-4 h-4" /> Message
              </Button>
              
              {currentUser?.username === 'hkahad' && currentUser?.id !== user.id && (
                <Button 
                  variant="outline" 
                  onClick={handleToggleVerify}
                  className={user.is_verified ? "text-red-500 border-red-200 hover:bg-red-50" : "text-blue-600 border-blue-200 hover:bg-blue-50"}
                >
                  {user.is_verified ? 'Remove Verified Badge' : 'Give Verified Badge'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-bold px-2">Posts</h3>
        {posts.length === 0 ? (
          <div className="text-center text-gray-500 py-8 bg-white rounded-lg shadow">No posts yet.</div>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                    {post.avatar_url ? (
                      <img src={post.avatar_url} alt={post.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                        {post.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-1">
                      <VerifiedBadge username={post.username} isVerified={post.is_verified} />
                      {post.username}
                    </div>
                    <div className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <p className="text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>
                {post.media_url && (
                  <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 mb-4">
                    {post.media_type === 'image' && (
                      <img src={post.media_url} alt="Post media" className="w-full max-h-[400px] object-contain" />
                    )}
                    {post.media_type === 'video' && (
                      <video src={post.media_url} controls className="w-full max-h-[400px]" />
                    )}
                    {post.media_type === 'audio' && (
                      <div className="p-4">
                        <audio src={post.media_url} controls className="w-full" />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between text-gray-500 text-sm border-t pt-3">
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="w-4 h-4" /> {post.likes_count}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" /> {post.comments_count}
                  </div>
                  <div className="flex items-center gap-1">
                    <Share2 className="w-4 h-4" /> Share
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
