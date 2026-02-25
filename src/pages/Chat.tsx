import React, { useEffect, useState, useRef, useMemo } from 'react';
import io from 'socket.io-client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Send, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  X, 
  ArrowLeft
} from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface User {
  id: number;
  username: string;
  avatar_url: string;
  is_verified?: number;
}

interface Message {
  sender_id?: number;
  senderId?: number;
  receiver_id?: number;
  receiverId?: number;
  content: string;
  media_url?: string;
  mediaUrl?: string;
  media_type?: 'text' | 'image' | 'video' | 'audio';
  mediaType?: 'text' | 'image' | 'video' | 'audio';
  roomId: string;
}

export default function Chat() {
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('userId');
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);

  // Use a stable socket instance
  const socket = useMemo(() => io(), []);

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();

    const handleMessage = (data: any) => {
      // Move user to top of list if they are in the list
      setUsers(prev => {
        const senderId = data.senderId || data.sender_id;
        const receiverId = data.receiverId || data.receiver_id;
        const otherId = senderId === currentUser?.id ? receiverId : senderId;
        
        const userIndex = prev.findIndex(u => u.id === otherId);
        if (userIndex > -1) {
          const newUsers = [...prev];
          const [user] = newUsers.splice(userIndex, 1);
          return [user, ...newUsers];
        } else {
          // If the user isn't in the list, we might want to fetch them or just wait for refresh
          // For now, let's just fetch the user details and add them to the top
          fetch(`/api/users/${otherId}`)
            .then(res => res.json())
            .then(user => {
              if (user && !user.error) {
                setUsers(current => [user, ...current.filter(u => u.id !== user.id)]);
              }
            });
          return prev;
        }
      });

      // Only add message if it belongs to the current chat room
      if (currentUser && selectedUser) {
        const currentRoomId = [currentUser.id, selectedUser.id].sort((a, b) => Number(a) - Number(b)).join('_');
        if (data.roomId === currentRoomId) {
          setMessages((prev) => {
            // Avoid duplicate messages (optimistic update check)
            const exists = prev.some(m => 
              m.content === data.content && 
              (m.senderId === data.senderId || m.sender_id === data.senderId) &&
              Math.abs(new Date().getTime() - new Date().getTime()) < 1000 // Simple throttle check
            );
            if (exists && data.senderId === currentUser.id) return prev;
            return [...prev, data];
          });
        }
      }
    };

    socket.on('receive_message', handleMessage);

    return () => {
      socket.off('receive_message', handleMessage);
    };
  }, [currentUser, selectedUser, socket]);

  useEffect(() => {
    if (targetUserId) {
      const existingUser = users.find(u => u.id === parseInt(targetUserId));
      if (existingUser) {
        setSelectedUser(existingUser);
      } else {
        // Fetch user details if not in the conversation list
        fetch(`/api/users/${targetUserId}`)
          .then(res => res.json())
          .then(data => {
            if (data && !data.error) {
              setSelectedUser(data);
              // Optionally add to users list so they appear in the sidebar
              setUsers(prev => [data, ...prev.filter(u => u.id !== data.id)]);
            }
          })
          .catch(err => console.error('Failed to fetch target user:', err));
      }
    }
  }, [targetUserId, users]);

  useEffect(() => {
    if (currentUser) {
      socket.emit('join_room', `user_${currentUser.id}`);
    }
  }, [currentUser, socket]);

  useEffect(() => {
    if (currentUser && selectedUser) {
      const roomId = [currentUser.id, selectedUser.id].sort((a, b) => Number(a) - Number(b)).join('_');
      socket.emit('join_room', roomId);
      
      // Fetch chat history
      fetch(`/api/chat/${roomId}?otherUserId=${selectedUser.id}`)
        .then(res => res.json())
        .then(data => setMessages(data))
        .catch(err => console.error('Failed to fetch chat history:', err));
    }
  }, [currentUser, selectedUser, socket]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || messages.length === 0) return;

    // Check if user is near the bottom (within 150px)
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
    
    // Check if the last message was sent by the current user
    const lastMessage = messages[messages.length - 1];
    const isMe = lastMessage && (lastMessage.senderId === currentUser?.id || lastMessage.sender_id === currentUser?.id);
    
    // Scroll to bottom if:
    // 1. It's the first time messages are loaded (prevMessagesLength is 0)
    // 2. User is already at the bottom
    // 3. Current user sent the message
    if (prevMessagesLength.current === 0 || isAtBottom || isMe) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    
    prevMessagesLength.current = messages.length;
  }, [messages, currentUser]);

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
      // Fetch conversations first (sorted by latest message)
      const res = await fetch('/api/chats/conversations');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !mediaFile && !audioBlob) || !currentUser || !selectedUser) return;

    let mediaUrl = '';
    let mediaType = 'text';

    if (mediaFile) {
      const formData = new FormData();
      formData.append('file', mediaFile);
      try {
        const res = await fetch('/api/chat/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          mediaUrl = data.media_url;
          mediaType = data.media_type;
        }
      } catch (error) {
        console.error('Upload failed:', error);
        return;
      }
    } else if (audioBlob) {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice_message.webm');
      try {
        const res = await fetch('/api/chat/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          mediaUrl = data.media_url;
          mediaType = 'audio';
        }
      } catch (error) {
        console.error('Audio upload failed:', error);
        return;
      }
    }

    const roomId = [currentUser.id, selectedUser.id].sort((a, b) => Number(a) - Number(b)).join('_');
    const messageData = {
      senderId: currentUser.id,
      receiverId: selectedUser.id,
      content: input,
      mediaUrl,
      mediaType: mediaType as any,
      roomId: roomId,
    };

    // Optimistic update
    setMessages(prev => [...prev, messageData]);

    socket.emit('send_message', messageData);
    setInput('');
    setMediaFile(null);
    setAudioBlob(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setMediaFile(e.target.files[0]);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`)
          .then(res => res.json())
          .then(data => setSearchResults(data))
          .catch(err => console.error('Search failed:', err));
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!selectedUser && users.length === 0) {
      fetch('/api/users')
        .then(res => res.json())
        .then(data => setAllUsers(data))
        .catch(err => console.error('Failed to fetch all users:', err));
    }
  }, [selectedUser, users]);

  if (!selectedUser) {
    return (
      <div className="container mx-auto p-4 max-w-2xl h-[calc(100vh-140px)]">
        <Card className="h-full flex flex-col glass border-white/10 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-white/5 space-y-4">
            <CardTitle className="text-2xl font-display font-bold text-white">Chats</CardTitle>
            <div className="relative">
              <Input 
                placeholder="Search people to message..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/5 border-white/10 rounded-xl pl-4 h-12 text-white placeholder:text-gray-500"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {searchQuery.trim() ? (
                searchResults.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group"
                    onClick={() => {
                      setSelectedUser(user);
                      setSearchQuery('');
                    }}
                  >
                    <div className="w-12 h-12 rounded-full bg-white/5 overflow-hidden border border-white/10 flex-shrink-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-400">
                          {user.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-gray-200 group-hover:text-white flex items-center gap-1">
                      <VerifiedBadge username={user.username} isVerified={user.is_verified} />
                      {user.username}
                    </div>
                  </div>
                ))
              ) : users.length > 0 ? (
                users.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group"
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className="w-14 h-14 rounded-full bg-white/5 overflow-hidden border border-white/10 flex-shrink-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                          {user.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-gray-200 group-hover:text-white flex items-center gap-1 text-lg">
                      <VerifiedBadge username={user.username} isVerified={user.is_verified} />
                      {user.username}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-4">
                  <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Suggested People</div>
                  {allUsers.map((user) => (
                    <div 
                      key={user.id} 
                      className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group"
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="w-12 h-12 rounded-full bg-white/5 overflow-hidden border border-white/10 flex-shrink-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-400">
                            {user.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="font-bold text-gray-200 group-hover:text-white flex items-center gap-1">
                        <VerifiedBadge username={user.username} isVerified={user.is_verified} />
                        {user.username}
                      </div>
                    </div>
                  ))}
                  {allUsers.length === 0 && (
                    <div className="text-center text-gray-500 mt-16">No users found. Try searching!</div>
                  )}
                </div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <div className="text-center text-gray-500 mt-16">No users found for "{searchQuery}"</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl h-[calc(100vh-140px)]">
      <Card className="h-full flex flex-col glass border-white/10 shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-white/[0.02] backdrop-blur-md sticky top-0 z-10">
          <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="-ml-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="w-12 h-12 rounded-full bg-white/5 overflow-hidden border border-white/10">
            {selectedUser.avatar_url ? (
              <img src={selectedUser.avatar_url} alt={selectedUser.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-400">
                {selectedUser.username[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="font-bold text-xl flex items-center gap-1 text-white">
            <VerifiedBadge username={selectedUser.username} isVerified={selectedUser.is_verified} />
            {selectedUser.username}
          </div>
        </div>
        
        {/* Messages Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-black/10">
          {messages.map((msg, idx) => {
            const senderId = msg.sender_id || msg.senderId;
            const isMe = senderId === currentUser?.id;
            return (
              <div key={idx} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
                  
                  {/* Avatar for other user */}
                  {!isMe && (
                    <div className="w-9 h-9 rounded-full bg-white/5 overflow-hidden flex-shrink-0 mb-1 border border-white/10">
                      {selectedUser.avatar_url ? (
                        <img src={selectedUser.avatar_url} alt={selectedUser.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                          {selectedUser.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div 
                    className={`
                      px-4 py-3 rounded-[24px] shadow-lg break-words relative group
                      ${isMe 
                        ? 'bg-blue-600 text-white rounded-br-none shadow-blue-500/20' 
                        : 'bg-blue-900/40 text-white rounded-bl-none border border-blue-500/20'
                      }
                    `}
                  >
                    {(msg.mediaUrl || msg.media_url) && (
                      <div className="mb-3 -mx-2 -mt-1">
                        {(msg.mediaType === 'image' || msg.media_type === 'image') && (
                          <img src={msg.mediaUrl || msg.media_url} alt="Shared" className="rounded-2xl max-w-full max-h-[400px] object-cover shadow-2xl" />
                        )}
                        {(msg.mediaType === 'video' || msg.media_type === 'video') && (
                          <video src={msg.mediaUrl || msg.media_url} controls className="rounded-2xl max-w-full max-h-[400px] shadow-2xl" />
                        )}
                        {(msg.mediaType === 'audio' || msg.media_type === 'audio') && (
                          <div className={`p-3 rounded-2xl ${isMe ? 'bg-black/20' : 'bg-white/5'}`}>
                            <audio src={msg.mediaUrl || msg.media_url} controls className="w-full min-w-[220px]" />
                          </div>
                        )}
                      </div>
                    )}
                    {msg.content && <p className="text-[15px] leading-relaxed font-medium">{msg.content}</p>}
                    
                    {/* Timestamp (Simulated) */}
                    <div className={`text-[10px] mt-1.5 opacity-40 font-bold uppercase tracking-wider ${isMe ? 'text-right' : 'text-left'}`}>
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/[0.02] border-t border-white/5 backdrop-blur-xl">
          {mediaFile && (
            <div className="flex items-center gap-3 mb-3 p-3 bg-white/5 rounded-2xl border border-white/10">
              <span className="text-sm truncate max-w-[200px] text-gray-300 font-medium">{mediaFile.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 rounded-full" onClick={() => setMediaFile(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {audioBlob && (
            <div className="flex items-center gap-3 mb-3 p-3 bg-white/5 rounded-2xl border border-white/10">
              <Mic className="w-5 h-5 text-accent animate-pulse" />
              <span className="text-sm text-gray-300 font-medium">Voice Message Recorded</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 rounded-full" onClick={() => setAudioBlob(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <div className="flex items-center gap-3">
             <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,video/*" 
              onChange={handleFileSelect} 
            />
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full w-11 h-11">
              <ImageIcon className="w-6 h-6" />
            </Button>
            
            <div className="flex-1 relative">
              <Input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Type a message..." 
                className="py-6 px-6 rounded-full bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-accent focus-visible:border-accent"
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
            </div>

            {input.trim() || mediaFile || audioBlob ? (
              <Button onClick={handleSendMessage} size="icon" className="rounded-full w-12 h-12 bg-accent hover:bg-accent/90 shadow-lg shadow-accent/30 transition-all hover:scale-105 active:scale-95">
                <Send className="w-5 h-5" />
              </Button>
            ) : (
              <Button 
                variant={isRecording ? "destructive" : "ghost"} 
                size="icon" 
                onMouseDown={startRecording} 
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`rounded-full w-12 h-12 transition-all ${isRecording ? 'animate-pulse bg-red-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                <Mic className="w-6 h-6" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
