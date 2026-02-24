import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Send, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  X, 
  Play, 
  Pause,
  ArrowLeft
} from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

const socket = io();

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

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();

    socket.on('receive_message', (data: any) => {
      // Map incoming socket data if needed, but we'll try to keep it consistent
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off('receive_message');
    };
  }, []);

  useEffect(() => {
    if (targetUserId && users.length > 0) {
      const user = users.find(u => u.id === parseInt(targetUserId));
      if (user) setSelectedUser(user);
    }
  }, [targetUserId, users]);

  useEffect(() => {
    if (currentUser && selectedUser) {
      const roomId = [currentUser.id, selectedUser.id].sort().join('_');
      socket.emit('join_room', roomId);
      
      // Fetch chat history
      fetch(`/api/chat/${roomId}?otherUserId=${selectedUser.id}`)
        .then(res => res.json())
        .then(data => setMessages(data))
        .catch(err => console.error('Failed to fetch chat history:', err));
    }
  }, [currentUser, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    const messageData = {
      senderId: currentUser.id,
      receiverId: selectedUser.id,
      content: input,
      mediaUrl,
      mediaType: mediaType as any,
      roomId: [currentUser.id, selectedUser.id].sort().join('_'),
    };

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

  if (!selectedUser) {
    // ... (keep existing user list UI)
    return (
      <div className="container mx-auto p-4 max-w-2xl h-[calc(100vh-140px)]">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Chats</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-2">
              {users.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden border border-gray-300 flex-shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-500">
                        {user.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold text-gray-900 flex items-center gap-1">
                    <VerifiedBadge username={user.username} isVerified={user.is_verified} />
                    {user.username}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="text-center text-gray-500 mt-10">No other users found.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl h-[calc(100vh-140px)]">
      <Card className="h-full flex flex-col shadow-md border-0 sm:border">
        {/* Header */}
        <div className="p-3 border-b flex items-center gap-3 bg-white sticky top-0 z-10">
          <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-300">
            {selectedUser.avatar_url ? (
              <img src={selectedUser.avatar_url} alt={selectedUser.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-bold text-gray-500">
                {selectedUser.username[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="font-semibold text-lg flex items-center gap-1">
            <VerifiedBadge username={selectedUser.username} isVerified={selectedUser.is_verified} />
            {selectedUser.username}
          </div>
        </div>
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
          {messages.map((msg, idx) => {
            const senderId = msg.sender_id || msg.senderId;
            const isMe = senderId === currentUser?.id;
            return (
              <div key={idx} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                  
                  {/* Avatar for other user */}
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 mb-1">
                      {selectedUser.avatar_url ? (
                        <img src={selectedUser.avatar_url} alt={selectedUser.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                          {selectedUser.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div 
                    className={`
                      px-4 py-2.5 rounded-[20px] shadow-sm break-words relative group
                      ${isMe 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white text-gray-900 rounded-bl-none border border-gray-100'
                      }
                    `}
                  >
                    {(msg.mediaUrl || msg.media_url) && (
                      <div className="mb-2 -mx-2 -mt-1">
                        {(msg.mediaType === 'image' || msg.media_type === 'image') && (
                          <img src={msg.mediaUrl || msg.media_url} alt="Shared" className="rounded-xl max-w-full max-h-[300px] object-cover shadow-sm" />
                        )}
                        {(msg.mediaType === 'video' || msg.media_type === 'video') && (
                          <video src={msg.mediaUrl || msg.media_url} controls className="rounded-xl max-w-full max-h-[300px] shadow-sm" />
                        )}
                        {(msg.mediaType === 'audio' || msg.media_type === 'audio') && (
                          <div className={`p-2 rounded-xl ${isMe ? 'bg-blue-700' : 'bg-gray-50'}`}>
                            <audio src={msg.mediaUrl || msg.media_url} controls className="w-full min-w-[200px]" />
                          </div>
                        )}
                      </div>
                    )}
                    {msg.content && <p className="text-[15px] leading-relaxed font-medium">{msg.content}</p>}
                    
                    {/* Timestamp (Simulated) */}
                    <div className={`text-[9px] mt-1 opacity-50 uppercase tracking-tighter ${isMe ? 'text-right' : 'text-left'}`}>
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
        <div className="p-3 bg-white border-t">
          {/* ... (keep existing input area logic) */}
          {mediaFile && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-gray-100 rounded-lg">
              <span className="text-sm truncate max-w-[200px]">{mediaFile.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMediaFile(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {audioBlob && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-gray-100 rounded-lg">
              <span className="text-sm">Voice Message Recorded</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAudioBlob(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
             {/* ... (keep existing input buttons) */}
             <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,video/*" 
              onChange={handleFileSelect} 
            />
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="w-5 h-5 text-gray-500" />
            </Button>
            
            <div className="flex-1 relative">
              <Input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Type a message..." 
                className="pr-10 rounded-full bg-gray-100 border-none focus-visible:ring-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
            </div>

            {input.trim() || mediaFile || audioBlob ? (
              <Button onClick={handleSendMessage} size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700">
                <Send className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                variant={isRecording ? "destructive" : "ghost"} 
                size="icon" 
                onMouseDown={startRecording} 
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`rounded-full ${isRecording ? 'animate-pulse' : ''}`}
              >
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
