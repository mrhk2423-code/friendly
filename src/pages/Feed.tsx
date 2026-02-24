import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  ThumbsUp, 
  MessageSquare, 
  Share2,
  Globe,
  Send,
  Image as ImageIcon,
  Video,
  Mic,
  X
} from 'lucide-react';
import io from 'socket.io-client';
import { VerifiedBadge } from '@/components/VerifiedBadge';

const socket = io();

interface Post {
  id: number;
  user_id: number;
  content: string;
  username: string;
  avatar_url: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  media_url?: string;
  media_type?: 'text' | 'image' | 'video' | 'audio';
  is_verified?: number;
}

interface Comment {
  id: number;
  content: string;
  username: string;
  avatar_url: string;
  created_at: string;
  is_verified?: number;
}

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{username: string, avatar_url: string} | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [isSharing, setIsSharing] = useState<Post | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts();
    fetchCurrentUser();
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

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !mediaFile) return;

    try {
      const formData = new FormData();
      formData.append('content', content);
      if (mediaFile) {
        formData.append('file', mediaFile);
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        fetchPosts(); // Refresh posts
        setContent('');
        setMediaFile(null);
        setMediaPreview(null);
      } else {
        if (res.status === 401 || res.status === 403) {
           navigate('/login');
        }
      }
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLike = async (postId: number) => {
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
      if (res.ok) {
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              is_liked: !post.is_liked,
              likes_count: post.is_liked ? post.likes_count - 1 : post.likes_count + 1
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const toggleComments = async (postId: number) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
    } else {
      setActiveCommentPostId(postId);
      if (!comments[postId]) {
        try {
          const res = await fetch(`/api/posts/${postId}/comments`);
          if (res.ok) {
            const data = await res.json();
            setComments(prev => ({ ...prev, [postId]: data }));
          }
        } catch (error) {
          console.error('Error fetching comments:', error);
        }
      }
    }
  };

  const handleCommentSubmit = async (postId: number) => {
    if (!commentInput.trim()) return;

    try {
      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentInput }),
      });

      if (res.ok) {
        setCommentInput('');
        // Refresh comments
        const commentsRes = await fetch(`/api/posts/${postId}/comments`);
        if (commentsRes.ok) {
          const data = await commentsRes.json();
          setComments(prev => ({ ...prev, [postId]: data }));
          // Update comment count locally
          setPosts(posts.map(post => 
            post.id === postId ? { ...post, comments_count: post.comments_count + 1 } : post
          ));
        }
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleShare = (user: any) => {
    if (!isSharing || !currentUser) return;
    
    const roomId = [currentUser.id, user.id].sort().join('_');
    const messageData = {
      senderId: currentUser.id,
      receiverId: user.id,
      content: `Check out this post: ${isSharing.content}`,
      mediaUrl: isSharing.media_url,
      mediaType: isSharing.media_type,
      roomId: roomId,
    };

    socket.emit('send_message', messageData);
    setIsSharing(null);
    alert(`Shared with ${user.username}!`);
  };

  return (
    <div className="bg-gray-100">
      {/* Create Post Section */}
      <div className="bg-white p-4 mt-2 mb-2 shadow-sm">
        <div className="flex gap-3 items-center">
          <div 
            className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden cursor-pointer"
            onClick={() => navigate('/profile')}
          >
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                {currentUser?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <input 
              className="w-full py-2 px-4 rounded-full border border-gray-300 bg-gray-50 focus:outline-none focus:bg-gray-100 transition-colors text-sm"
              value={content} 
              onChange={(e) => setContent(e.target.value)} 
              placeholder="What's on your mind?" 
            />
          </div>
        </div>

        {mediaPreview && (
          <div className="mt-3 relative rounded-lg overflow-hidden border border-gray-200">
            {mediaFile?.type.startsWith('image/') ? (
              <img src={mediaPreview} alt="Preview" className="w-full max-h-60 object-cover" />
            ) : mediaFile?.type.startsWith('video/') ? (
              <video src={mediaPreview} className="w-full max-h-60" controls />
            ) : (
              <div className="p-4 bg-gray-50 flex items-center gap-2">
                <Mic className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">{mediaFile?.name}</span>
              </div>
            )}
            <button 
              className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
              onClick={() => { setMediaFile(null); setMediaPreview(null); }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
          <div className="flex gap-1">
            <button 
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="w-5 h-5 text-green-500" />
              <span className="text-xs font-medium">Photo</span>
            </button>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600"
              onClick={() => fileInputRef.current?.click()}
            >
              <Video className="w-5 h-5 text-red-500" />
              <span className="text-xs font-medium">Video</span>
            </button>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600"
              onClick={() => fileInputRef.current?.click()}
            >
              <Mic className="w-5 h-5 text-orange-500" />
              <span className="text-xs font-medium">Audio</span>
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,video/*,audio/*" 
            onChange={handleFileSelect} 
          />
          {(content.trim() || mediaFile) && (
            <Button onClick={handlePost} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-6">
              Post
            </Button>
          )}
        </div>
      </div>

      {/* Feed Posts */}
      <div className="space-y-3 pb-4">
        {posts.map((post) => (
          <div key={post.id} className="bg-white shadow-sm border-b border-gray-100 overflow-hidden">
            {/* Post Header */}
            <div className="flex justify-between items-center p-4">
              <div className="flex gap-3 items-center">
                <div 
                  className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-100 cursor-pointer"
                  onClick={() => navigate(`/users/${post.user_id || post.id}`)} // Assuming user_id is available or id is user_id in some contexts
                >
                  {post.avatar_url ? (
                    <img src={post.avatar_url} alt={post.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                      {post.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-bold text-[15px] text-gray-900 leading-tight hover:underline cursor-pointer flex items-center gap-1">
                    <VerifiedBadge username={post.username} isVerified={post.is_verified} />
                    {post.username}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5 font-medium uppercase tracking-wider">
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <Globe className="w-3 h-3" />
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-50 cursor-pointer transition-colors">
                <MoreHorizontal className="w-5 h-5 text-gray-400" />
              </div>
            </div>

            {/* Post Content */}
            <div className="px-4 pb-3">
              {post.content && <p className="text-[15px] text-gray-800 whitespace-pre-wrap leading-relaxed mb-3">{post.content}</p>}
              {post.media_url && (
                <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 mb-2">
                  {post.media_type === 'image' && (
                    <img src={post.media_url} alt="Post media" className="w-full max-h-[500px] object-contain" />
                  )}
                  {post.media_type === 'video' && (
                    <video src={post.media_url} controls className="w-full max-h-[500px]" />
                  )}
                  {post.media_type === 'audio' && (
                    <div className="p-4">
                      <audio src={post.media_url} controls className="w-full" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Post Stats */}
            <div className="px-4 py-2 flex justify-between items-center text-[13px] text-gray-500 border-t border-gray-50">
              <div className="flex items-center gap-1.5">
                {post.likes_count > 0 && (
                  <div className="flex items-center -space-x-1">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                      <ThumbsUp className="w-2.5 h-2.5 text-white fill-current" />
                    </div>
                    <span className="pl-2 font-medium">{post.likes_count}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {post.comments_count > 0 && (
                  <span className="hover:underline cursor-pointer font-medium" onClick={() => toggleComments(post.id)}>
                    {post.comments_count} comments
                  </span>
                )}
              </div>
            </div>

            {/* Post Actions */}
            <div className="px-2 py-1 flex justify-between items-center border-t border-gray-50">
              <ActionButton 
                icon={<ThumbsUp className={`w-5 h-5 ${post.is_liked ? 'fill-current' : ''}`} />} 
                label="Like" 
                active={post.is_liked} 
                onClick={() => handleLike(post.id)} 
              />
              <ActionButton 
                icon={<MessageSquare className="w-5 h-5" />} 
                label="Comment" 
                onClick={() => toggleComments(post.id)} 
              />
              <ActionButton 
                icon={<Share2 className="w-5 h-5" />} 
                label="Share" 
                onClick={() => setIsSharing(post)}
              />
            </div>

            {/* Share Modal */}
            {isSharing && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold">Share with Friends</h3>
                    <button onClick={() => setIsSharing(null)}><X className="w-6 h-6" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {users.map(user => (
                      <div 
                        key={user.id} 
                        className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl cursor-pointer"
                        onClick={() => handleShare(user)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                            {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-500">{user.username[0]}</div>}
                          </div>
                          <span className="font-medium">{user.username}</span>
                        </div>
                        <Send className="w-5 h-5 text-blue-600" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Comments Section */}
            {activeCommentPostId === post.id && (
              <div className="px-3 py-2 bg-gray-50">
                <div className="space-y-3 mb-3">
                  {comments[post.id]?.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {comment.avatar_url ? (
                          <img src={comment.avatar_url} alt={comment.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                            {comment.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-200 rounded-2xl px-3 py-2">
                        <div className="font-semibold text-xs flex items-center gap-1">
                          <VerifiedBadge username={comment.username} isVerified={comment.is_verified} className="w-3 h-3 bg-blue-500 text-white rounded-full font-bold text-[8px]" />
                          {comment.username}
                        </div>
                        <div className="text-sm">{comment.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {currentUser?.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                        {currentUser?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <input 
                      className="w-full py-2 pl-3 pr-10 rounded-full border border-gray-300 focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="Write a comment..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit(post.id)}
                    />
                    <button 
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-700"
                      onClick={() => handleCommentSubmit(post.id)}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-gray-50 rounded-lg transition-all active:scale-95 ${active ? 'text-blue-600' : 'text-gray-500'}`}
      onClick={onClick}
    >
      {icon}
      <span className="text-[13px] font-bold">{label}</span>
    </button>
  );
}

