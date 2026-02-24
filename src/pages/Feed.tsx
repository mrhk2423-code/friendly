import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const postRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    fetchPosts();
    fetchCurrentUser();
    fetchUsers();
  }, []);

  useEffect(() => {
    const postId = searchParams.get('postId');
    if (postId && posts.length > 0) {
      const id = parseInt(postId);
      setTimeout(() => {
        postRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [searchParams, posts]);

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
    
    const roomId = [currentUser.id, user.id].sort((a, b) => Number(a) - Number(b)).join('_');
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
    <div className="">
      {/* Create Post Section */}
      <div className="glass p-4 mt-4 mb-4 rounded-2xl border-white/10">
        <div className="flex gap-3 items-center">
          <div 
            className="w-10 h-10 rounded-full bg-white/5 overflow-hidden cursor-pointer border border-white/10"
            onClick={() => navigate('/profile')}
          >
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                {currentUser?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <input 
              className="w-full py-2.5 px-5 rounded-full border border-white/10 bg-white/5 focus:outline-none focus:bg-white/10 focus:border-accent transition-all text-sm text-white placeholder:text-gray-500"
              value={content} 
              onChange={(e) => setContent(e.target.value)} 
              placeholder="What's on your mind?" 
            />
          </div>
        </div>

        {mediaPreview && (
          <div className="mt-4 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            {mediaFile?.type.startsWith('image/') ? (
              <img src={mediaPreview} alt="Preview" className="w-full max-h-60 object-cover" />
            ) : mediaFile?.type.startsWith('video/') ? (
              <video src={mediaPreview} className="w-full max-h-60" controls />
            ) : (
              <div className="p-6 bg-white/5 flex items-center gap-3">
                <Mic className="w-6 h-6 text-accent" />
                <span className="text-sm text-gray-300 font-medium">{mediaFile?.name}</span>
              </div>
            )}
            <button 
              className="absolute top-3 right-3 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 backdrop-blur-md transition-all"
              onClick={() => { setMediaFile(null); setMediaPreview(null); }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
          <div className="flex gap-2">
            <button 
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-semibold">Photo</span>
            </button>
            <button 
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              <Video className="w-5 h-5 text-rose-400" />
              <span className="text-xs font-semibold">Video</span>
            </button>
            <button 
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              <Mic className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-semibold">Audio</span>
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
            <Button onClick={handlePost} size="sm" className="bg-accent hover:bg-accent/90 text-white rounded-xl px-8 font-bold shadow-lg shadow-accent/20">
              Post
            </Button>
          )}
        </div>
      </div>

      {/* Feed Posts */}
      <div className="space-y-4 pb-6">
        {posts.map((post) => (
          <div 
            key={post.id} 
            ref={el => postRefs.current[post.id] = el}
            className="glass rounded-2xl border-white/10 overflow-hidden shadow-xl"
          >
            {/* Post Header */}
            <div className="flex justify-between items-center p-4">
              <div className="flex gap-3 items-center">
                <div 
                  className="w-11 h-11 rounded-full bg-white/5 overflow-hidden border border-white/10 cursor-pointer"
                  onClick={() => navigate(`/users/${post.user_id || post.id}`)}
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
                  <div className="font-bold text-[16px] text-white leading-tight hover:text-accent transition-colors cursor-pointer flex items-center gap-1">
                    <VerifiedBadge username={post.username} isVerified={post.is_verified} />
                    {post.username}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1 font-semibold uppercase tracking-wider">
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <Globe className="w-3 h-3" />
                  </div>
                </div>
              </div>
              <div className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 cursor-pointer transition-colors">
                <MoreHorizontal className="w-5 h-5 text-gray-500" />
              </div>
            </div>

            {/* Post Content */}
            <div className="px-4 pb-4">
              {post.content && <p className="text-[15px] text-gray-300 whitespace-pre-wrap leading-relaxed mb-4">{post.content}</p>}
              {post.media_url && (
                <div className="rounded-2xl overflow-hidden border border-white/5 bg-black/20 mb-3">
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
            <div className="px-4 py-3 flex justify-between items-center text-[13px] text-gray-500 border-t border-white/5">
              <div className="flex items-center gap-2">
                {post.likes_count > 0 && (
                  <div className="flex items-center -space-x-1.5">
                    <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center border-2 border-bg shadow-lg">
                      <ThumbsUp className="w-3 h-3 text-white fill-current" />
                    </div>
                    <span className="pl-3 font-semibold text-gray-400">{post.likes_count}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                {post.comments_count > 0 && (
                  <span className="hover:text-accent cursor-pointer font-semibold transition-colors" onClick={() => toggleComments(post.id)}>
                    {post.comments_count} comments
                  </span>
                )}
              </div>
            </div>

            {/* Post Actions */}
            <div className="px-2 py-1.5 flex justify-between items-center border-t border-white/5 bg-white/[0.02]">
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
              <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="glass rounded-3xl w-full max-w-md flex flex-col max-h-[80vh] border-white/10 shadow-2xl">
                  <div className="p-5 border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-display font-bold text-xl text-white">Share with Friends</h3>
                    <button onClick={() => setIsSharing(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {users.map(user => (
                      <div 
                        key={user.id} 
                        className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group"
                        onClick={() => handleShare(user)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-white/5 overflow-hidden border border-white/10">
                            {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">{user.username[0]}</div>}
                          </div>
                          <span className="font-semibold text-gray-200 group-hover:text-white">{user.username}</span>
                        </div>
                        <Send className="w-5 h-5 text-accent group-hover:scale-110 transition-transform" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Comments Section */}
            {activeCommentPostId === post.id && (
              <div className="px-4 py-4 bg-white/[0.03] border-t border-white/5">
                <div className="space-y-4 mb-5">
                  {comments[post.id]?.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-white/5 overflow-hidden flex-shrink-0 border border-white/10">
                        {comment.avatar_url ? (
                          <img src={comment.avatar_url} alt={comment.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                            {comment.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="bg-white/5 rounded-2xl px-4 py-2.5 border border-white/5">
                        <div className="font-bold text-xs flex items-center gap-1 text-white mb-1">
                          <VerifiedBadge username={comment.username} isVerified={comment.is_verified} className="w-3 h-3 bg-accent text-white rounded-full font-bold text-[8px]" />
                          {comment.username}
                        </div>
                        <div className="text-[14px] text-gray-300 leading-relaxed">{comment.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 items-center">
                  <div className="w-9 h-9 rounded-full bg-white/5 overflow-hidden flex-shrink-0 border border-white/10">
                    {currentUser?.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                        {currentUser?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <input 
                      className="w-full py-2.5 pl-4 pr-12 rounded-full border border-white/10 bg-white/5 focus:outline-none focus:border-accent text-sm text-white placeholder:text-gray-500"
                      placeholder="Write a comment..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit(post.id)}
                    />
                    <button 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-accent hover:scale-110 transition-transform"
                      onClick={() => handleCommentSubmit(post.id)}
                    >
                      <Send className="w-5 h-5" />
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
      className={`flex-1 flex items-center justify-center gap-2 py-3 hover:bg-white/5 rounded-xl transition-all active:scale-95 ${active ? 'text-accent' : 'text-gray-500 hover:text-gray-300'}`}
      onClick={onClick}
    >
      {icon}
      <span className="text-[13px] font-bold">{label}</span>
    </button>
  );
}

