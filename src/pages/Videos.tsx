import React, { useEffect, useState, useRef } from 'react';
import { Play, Heart, MessageCircle, Share2, Globe, Plus, X, Video as VideoIcon, Send, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import io from 'socket.io-client';
import { VerifiedBadge } from '@/components/VerifiedBadge';

const socket = io();

interface VideoPost {
  id: number;
  content: string;
  media_url: string;
  created_at: string;
  username: string;
  avatar_url: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_verified?: number;
}

export default function Videos() {
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [activeCommentVideoId, setActiveCommentVideoId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, any[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSharing, setIsSharing] = useState<VideoPost | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchVideos();
    fetchCurrentUser();
    fetchUsers();
  }, []);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.7,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          video.play().catch(err => console.log("Autoplay blocked:", err));
        } else {
          video.pause();
        }
      });
    }, options);

    const currentRefs = videoRefs.current;
    Object.values(currentRefs).forEach((video) => {
      if (video instanceof Element) observer.observe(video);
    });

    return () => {
      Object.values(currentRefs).forEach((video) => {
        if (video instanceof Element) observer.unobserve(video);
      });
    };
  }, [videos]);

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

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos');
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const handleLike = async (videoId: number) => {
    try {
      const res = await fetch(`/api/posts/${videoId}/like`, { method: 'POST' });
      if (res.ok) {
        setVideos(videos.map(v => {
          if (v.id === videoId) {
            return {
              ...v,
              is_liked: !v.is_liked,
              likes_count: v.is_liked ? v.likes_count - 1 : v.likes_count + 1
            };
          }
          return v;
        }));
      }
    } catch (error) {
      console.error('Error liking video:', error);
    }
  };

  const toggleComments = async (videoId: number) => {
    if (activeCommentVideoId === videoId) {
      setActiveCommentVideoId(null);
    } else {
      setActiveCommentVideoId(videoId);
      if (!comments[videoId]) {
        try {
          const res = await fetch(`/api/posts/${videoId}/comments`);
          if (res.ok) {
            const data = await res.json();
            setComments(prev => ({ ...prev, [videoId]: data }));
          }
        } catch (error) {
          console.error('Error fetching comments:', error);
        }
      }
    }
  };

  const handleCommentSubmit = async (videoId: number) => {
    if (!commentInput.trim()) return;
    try {
      const res = await fetch(`/api/posts/${videoId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentInput }),
      });
      if (res.ok) {
        setCommentInput('');
        const commentsRes = await fetch(`/api/posts/${videoId}/comments`);
        if (commentsRes.ok) {
          const data = await commentsRes.json();
          setComments(prev => ({ ...prev, [videoId]: data }));
          setVideos(videos.map(v => 
            v.id === videoId ? { ...v, comments_count: v.comments_count + 1 } : v
          ));
        }
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handlePostVideo = async () => {
    if (!videoFile) return;
    const formData = new FormData();
    formData.append('content', content);
    formData.append('file', videoFile);
    try {
      const res = await fetch('/api/posts', { method: 'POST', body: formData });
      if (res.ok) {
        setIsPosting(false);
        setVideoFile(null);
        setVideoPreview(null);
        setContent('');
        fetchVideos();
      }
    } catch (error) {
      console.error('Error posting video:', error);
    }
  };

  const handleShare = (user: any) => {
    if (!isSharing || !currentUser) return;
    
    const roomId = [currentUser.id, user.id].sort().join('_');
    const messageData = {
      senderId: currentUser.id,
      receiverId: user.id,
      content: `Check out this video: ${isSharing.content}`,
      mediaUrl: isSharing.media_url,
      mediaType: 'video',
      roomId: roomId,
    };

    socket.emit('send_message', messageData);
    setIsSharing(null);
    alert(`Shared with ${user.username}!`);
  };

  return (
    <div className="bg-black h-screen overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-800 bg-black z-10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Play className="w-6 h-6 text-red-600 fill-current" />
          <h1 className="text-xl font-bold text-white tracking-tight">friendly TV</h1>
        </div>
        <button 
          className="px-4 py-1.5 bg-red-600 text-white rounded-full flex items-center gap-2 text-sm font-bold hover:bg-red-700 transition-colors active:scale-95"
          onClick={() => setIsPosting(true)}
        >
          <Plus className="w-4 h-4" />
          Post
        </button>
      </div>

      {isPosting && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col p-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-white text-xl font-bold">Post Video</h2>
            <button onClick={() => setIsPosting(false)} className="text-white"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="flex-1 flex flex-col gap-4">
            <div className="bg-blue-600/20 border border-blue-500/50 p-3 rounded-xl flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">Public Post: Everyone on friendly TV can see this</span>
            </div>
            
            <div 
              className="aspect-[9/16] bg-gray-900 rounded-2xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative"
              onClick={() => !videoPreview && fileInputRef.current?.click()}
            >
              {videoPreview ? (
                <video src={videoPreview} className="w-full h-full object-contain" controls />
              ) : (
                <>
                  <VideoIcon className="w-12 h-12 text-gray-500 mb-2" />
                  <span className="text-gray-500">Select Video</span>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} />
            
            <textarea 
              className="bg-gray-800 text-white p-4 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Add a caption..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
              disabled={!videoFile}
              onClick={handlePostVideo}
            >
              <Globe className="w-5 h-5" />
              Publish Publicly
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col h-[calc(100vh-120px)] overflow-y-auto snap-y snap-mandatory scrollbar-hide">
        {videos.length > 0 ? (
          videos.map((video) => (
            <div key={video.id} className="relative h-full w-full bg-black overflow-hidden snap-start border-b border-gray-900 flex-shrink-0">
              <video 
                ref={(el) => (videoRefs.current[video.id] = el)}
                src={video.media_url} 
                className="w-full h-full object-contain"
                loop
                playsInline
                muted={isMuted}
                onClick={(e) => {
                  const v = e.currentTarget;
                  v.paused ? v.play() : v.pause();
                }}
              />

              {/* Volume Toggle */}
              <div 
                className="absolute top-20 right-4 z-30 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center cursor-pointer text-white"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </div>
              
              {/* Overlay Info */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-12 h-12 rounded-full border-2 border-white overflow-hidden cursor-pointer pointer-events-auto"
                    onClick={() => navigate(`/users/${video.username}`)}
                  >
                    {video.avatar_url ? (
                      <img src={video.avatar_url} alt={video.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-500 flex items-center justify-center text-white font-bold">
                        {video.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="text-white pointer-events-auto">
                    <div className="font-bold text-base shadow-sm flex items-center gap-1">
                      <VerifiedBadge username={video.username} isVerified={video.is_verified} />
                      @{video.username}
                    </div>
                    <div className="text-[10px] opacity-70 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {new Date(video.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <p className="text-white text-sm leading-snug max-w-[80%] shadow-sm">{video.content}</p>
              </div>

              {/* Side Actions */}
              <div className="absolute right-4 bottom-24 flex flex-col gap-5 items-center z-20">
                <div className="flex flex-col items-center gap-1">
                  <div 
                    className={`w-14 h-14 bg-black/40 backdrop-blur-lg rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 ${video.is_liked ? 'text-red-500' : 'text-white'}`}
                    onClick={() => handleLike(video.id)}
                  >
                    <Heart className={`w-7 h-7 ${video.is_liked ? 'fill-current' : ''}`} />
                  </div>
                  <span className="text-white text-xs font-bold shadow-sm">{video.likes_count}</span>
                </div>
                
                <div className="flex flex-col items-center gap-1">
                  <div 
                    className="w-14 h-14 bg-black/40 backdrop-blur-lg rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 text-white"
                    onClick={() => toggleComments(video.id)}
                  >
                    <MessageCircle className="w-7 h-7" />
                  </div>
                  <span className="text-white text-xs font-bold shadow-sm">{video.comments_count}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div 
                    className="w-14 h-14 bg-black/40 backdrop-blur-lg rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 text-white"
                    onClick={() => setIsSharing(video)}
                  >
                    <Share2 className="w-7 h-7" />
                  </div>
                  <span className="text-white text-xs font-bold shadow-sm">Share</span>
                </div>
              </div>

              {/* Share Modal */}
              {isSharing && (
                <div className="absolute inset-0 bg-black/95 z-40 flex flex-col p-6 animate-in fade-in slide-in-from-bottom-10 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <Share2 className="w-5 h-5 text-blue-400" />
                      <h3 className="text-white font-bold text-lg">Share with Friends</h3>
                    </div>
                    <button 
                      onClick={() => setIsSharing(null)} 
                      className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {users.map(user => (
                      <div 
                        key={user.id} 
                        className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer border border-white/5"
                        onClick={() => handleShare(user)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden border border-white/10">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-white text-lg">
                                {user.username[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="text-white font-semibold text-base flex items-center gap-1">
                            <VerifiedBadge username={user.username} isVerified={user.is_verified} />
                            {user.username}
                          </span>
                        </div>
                        <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center">
                          <Send className="w-5 h-5 text-blue-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments Overlay */}
              {activeCommentVideoId === video.id && (
                <div className="absolute inset-x-0 bottom-0 top-1/2 bg-white rounded-t-3xl p-4 z-30 overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold">Comments</h4>
                    <button onClick={() => setActiveCommentVideoId(null)} className="text-gray-500">Close</button>
                  </div>
                  <div className="space-y-4 mb-20">
                    {comments[video.id]?.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                          {c.avatar_url ? <img src={c.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gray-300 font-bold">{c.username[0]}</div>}
                        </div>
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1">
                            <VerifiedBadge username={c.username} isVerified={c.is_verified} className="w-3 h-3 bg-blue-500 text-white rounded-full font-bold text-[8px]" />
                            {c.username}
                          </div>
                          <div className="text-sm">{c.content}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t">
                    <div className="flex gap-2">
                      <input 
                        className="flex-1 border rounded-full px-4 py-2 text-sm"
                        placeholder="Add a comment..."
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit(video.id)}
                      />
                      <button 
                        className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold"
                        onClick={() => handleCommentSubmit(video.id)}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-20 text-center text-gray-500">
            <Play className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>No videos yet. Be the first to post one!</p>
          </div>
        )}
      </div>
    </div>
  );
}
