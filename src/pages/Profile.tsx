import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, ThumbsUp, MessageCircle, Share2 } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  username: string;
  email: string;
  bio: string;
  avatar_url: string;
  real_name: string;
  date_of_birth: string;
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
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [realName, setRealName] = useState('');
  const [dob, setDob] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMe = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Profile fetch error:', error);
        return;
      }

      const userData = profile || { 
        id: authUser.id, 
        username: authUser.email?.split('@')[0], 
        email: authUser.email,
        bio: '',
        avatar_url: '',
        real_name: '',
        date_of_birth: ''
      };

      setUser(userData);
      setUsername(userData.username || '');
      setBio(userData.bio || '');
      setRealName(userData.real_name || '');
      setDob(userData.date_of_birth || '');
      fetchUserPosts(userData.id);
    };

    fetchMe();
  }, [navigate]);

  const fetchUserPosts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          likes_count:likes(count),
          comments_count:comments(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedPosts = data.map(p => ({
        ...p,
        likes_count: p.likes_count?.[0]?.count || 0,
        comments_count: p.comments_count?.[0]?.count || 0,
      }));

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };

  const handleUpdate = async () => {
    if (!user) return;
    setIsSaving(true);
    setUpdateError('');
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username,
          bio,
          avatar_url: user.avatar_url,
          real_name: realName,
          date_of_birth: dob,
          email: user.email
        });

      if (error) throw error;

      setUser((prev) => prev ? { ...prev, username, bio, real_name: realName, date_of_birth: dob } : null);
      setIsEditing(false);
      alert('Profile updated successfully!');
      navigate('/feed');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setUpdateError(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: publicUrl });

      if (updateError) throw updateError;

      setUser((prev) => prev ? { ...prev, avatar_url: publicUrl } : null);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile</CardTitle>
          <Button variant="outline" onClick={handleLogout}>Logout</Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden border-4 border-white shadow-lg">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-4xl font-bold bg-gray-300">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white w-8 h-8" />
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <VerifiedBadge username={user.username} className="w-6 h-6 bg-blue-500 text-white rounded-full font-bold text-[14px]" />
              {user.username}
            </h2>
            <p className="text-gray-500">{user.email}</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">About Me</h3>
              <Button variant="ghost" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? 'Cancel' : 'Edit Bio'}
              </Button>
            </div>
            
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <Input 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Real Name</label>
                  <Input 
                    value={realName} 
                    onChange={(e) => setRealName(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Date of Birth</label>
                  <Input 
                    type="date"
                    value={dob} 
                    onChange={(e) => setDob(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Bio</label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)} 
                    placeholder="Tell us about yourself..."
                  />
                </div>
                {updateError && <p className="text-red-500 text-sm">{updateError}</p>}
                <Button onClick={handleUpdate} className="w-full" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save & Go to Feed'}
                </Button>
              </div>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">{user.bio || 'No bio yet.'}</p>
            )}
            
            {!isEditing && (
               <Button onClick={() => navigate('/feed')} className="w-full mt-4" variant="secondary">Go to Feed</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-bold px-2">My Posts</h3>
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
                      <VerifiedBadge username={post.username} />
                      {post.username}
                    </div>
                    <div className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <p className="text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>
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
