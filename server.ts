import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import { supabase } from './src/lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  console.log('Creating uploads directory...');
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Helper to create notifications
const createNotification = async (userId: number, type: string, senderId?: number, postId?: number, content?: string) => {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      sender_id: senderId || null,
      post_id: postId || null,
      content: content || null
    });
  
  if (error) console.error('Error creating notification:', error);
};

// Helper to notify all users except one
const notifyAllUsers = async (type: string, senderId: number, postId?: number, content?: string) => {
  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .neq('id', senderId);

  if (error) {
    console.error('Error fetching users for notification:', error);
    return;
  }

  if (users) {
    for (const user of users) {
      await createNotification(user.id, type, senderId, postId, content);
    }
  }
};

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    next();
  });
};

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Upload Avatar Endpoint
app.post('/api/users/avatar', authenticateToken, upload.single('avatar'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const avatarUrl = `/uploads/${req.file.filename}`;
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, avatar_url: avatarUrl });
});

// Upload Chat Media Endpoint
app.post('/api/chat/upload', authenticateToken, upload.single('file'), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const mediaUrl = `/uploads/${req.file.filename}`;
  const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 
                    req.file.mimetype.startsWith('video/') ? 'video' : 
                    req.file.mimetype.startsWith('audio/') ? 'audio' : 'file';
  
  res.json({ success: true, media_url: mediaUrl, media_type: mediaType });
});

// Mark notifications as read
app.post('/api/notifications/read', authenticateToken, async (req: any, res) => {
  await supabase
    .from('notifications')
    .update({ is_read: 1 })
    .eq('user_id', req.user.id);
  res.json({ success: true });
});

// Get notifications
app.get('/api/notifications', authenticateToken, async (req: any, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      sender:users!notifications_sender_id_fkey(username, avatar_url, is_verified)
    `)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  
  // Flatten the response to match previous SQLite structure
  const notifications = data.map(n => ({
    ...n,
    sender_username: n.sender?.username,
    sender_avatar: n.sender?.avatar_url,
    sender_verified: n.sender?.is_verified
  }));
  
  res.json(notifications);
});

// Get videos (TV section)
app.get('/api/videos', authenticateToken, async (req: any, res) => {
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(username, avatar_url, is_verified),
      likes:likes(count),
      comments:comments(count)
    `)
    .eq('media_type', 'video')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Check if liked for each post
  const { data: userLikes } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', req.user.id);

  const likedPostIds = new Set(userLikes?.map(l => l.post_id) || []);

  const formattedPosts = posts.map(p => ({
    ...p,
    username: p.user?.username,
    avatar_url: p.user?.avatar_url,
    is_verified: p.user?.is_verified,
    likes_count: p.likes?.[0]?.count || 0,
    comments_count: p.comments?.[0]?.count || 0,
    is_liked: likedPostIds.has(p.id)
  }));

  res.json(formattedPosts);
});

// Socket.io connection
io.on('connection', (socket) => {
  socket.on('join_room', (room) => {
    socket.join(room);
  });

  socket.on('send_message', async (data) => {
    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: data.senderId,
        receiver_id: data.receiverId,
        content: data.content,
        media_url: data.mediaUrl,
        media_type: data.mediaType || 'text'
      });
    
    if (!error) {
      io.to(data.roomId).emit('receive_message', data);
      io.to(`user_${data.receiverId}`).emit('receive_message', data);
    }
  });
});

// Get all posts
app.get('/api/posts', authenticateToken, async (req: any, res) => {
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(username, avatar_url, is_verified),
      likes:likes(count),
      comments:comments(count)
    `)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: userLikes } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', req.user.id);

  const likedPostIds = new Set(userLikes?.map(l => l.post_id) || []);

  const formattedPosts = posts.map(p => ({
    ...p,
    username: p.user?.username,
    avatar_url: p.user?.avatar_url,
    is_verified: p.user?.is_verified,
    likes_count: p.likes?.[0]?.count || 0,
    comments_count: p.comments?.[0]?.count || 0,
    is_liked: likedPostIds.has(p.id)
  }));

  res.json(formattedPosts);
});

// Toggle Like
app.post('/api/posts/:id/like', authenticateToken, async (req: any, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  
  const { data: existingLike } = await supabase
    .from('likes')
    .select('*')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .single();

  if (existingLike) {
    await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId);
    res.json({ liked: false });
  } else {
    await supabase.from('likes').insert({ user_id: userId, post_id: postId });
    
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
    if (post && post.user_id !== userId) {
      await createNotification(post.user_id, 'like', userId, Number(postId), 'liked your post');
    }
    res.json({ liked: true });
  }
});

// Add Comment
app.post('/api/posts/:id/comment', authenticateToken, async (req: any, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({ user_id: req.user.id, post_id: req.params.id, content })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const { data: post } = await supabase.from('posts').select('user_id').eq('id', req.params.id).single();
  if (post && post.user_id !== req.user.id) {
    await createNotification(post.user_id, 'comment', req.user.id, Number(req.params.id), `commented: ${content.substring(0, 30)}`);
  }

  res.json({ success: true });
});

// Get Comments
app.get('/api/posts/:id/comments', authenticateToken, async (req: any, res) => {
  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      *,
      user:users(username, avatar_url, is_verified)
    `)
    .eq('post_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const formattedComments = comments.map(c => ({
    ...c,
    username: c.user?.username,
    avatar_url: c.user?.avatar_url,
    is_verified: c.user?.is_verified
  }));

  res.json(formattedComments);
});

// Get all users
app.get('/api/users', authenticateToken, async (req: any, res) => {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, avatar_url, bio, is_verified')
    .neq('id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json(users);
});

// Search users
app.get('/api/users/search', authenticateToken, async (req: any, res) => {
  const query = req.query.q;
  if (!query) return res.json([]);
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, avatar_url, bio, is_verified')
    .ilike('username', `%${query}%`)
    .neq('id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json(users);
});

// Get specific user profile
app.get('/api/users/:id', authenticateToken, async (req: any, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, avatar_url, bio, is_verified')
    .eq('id', req.params.id)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Toggle Verification
app.post('/api/users/:id/verify', authenticateToken, async (req: any, res) => {
  const { data: currentUser } = await supabase.from('users').select('username').eq('id', req.user.id).single();
  if (!currentUser || currentUser.username !== 'hkahad') {
    return res.status(403).json({ error: 'Only hkahad can verify users' });
  }

  const { data: user } = await supabase.from('users').select('is_verified').eq('id', req.params.id).single();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newStatus = user.is_verified ? 0 : 1;
  await supabase.from('users').update({ is_verified: newStatus }).eq('id', req.params.id);
  
  res.json({ success: true, is_verified: newStatus });
});

// Create a post
app.post('/api/posts', authenticateToken, upload.single('file'), async (req: any, res) => {
  const { content } = req.body;
  if (!content && !req.file) return res.status(400).json({ error: 'Content or file is required' });

  let mediaUrl = null;
  let mediaType = 'text';

  if (req.file) {
    mediaUrl = `/uploads/${req.file.filename}`;
    mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 
                req.file.mimetype.startsWith('video/') ? 'video' : 
                req.file.mimetype.startsWith('audio/') ? 'audio' : 'file';
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({ user_id: req.user.id, content: content || '', media_url: mediaUrl, media_type: mediaType })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  
  await notifyAllUsers('new_post', req.user.id, post.id, content ? content.substring(0, 50) : 'Shared a file');

  const { data: fullPost } = await supabase
    .from('posts')
    .select('*, user:users(username, avatar_url)')
    .eq('id', post.id)
    .single();
  
  res.json({ ...fullPost, username: fullPost.user?.username, avatar_url: fullPost.user?.avatar_url });
});

// Register
app.post('/api/auth/register', async (req, res) => {
  const schema = z.object({
    username: z.string().min(3).trim().toLowerCase(),
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(6),
    real_name: z.string().min(1).trim(),
    date_of_birth: z.string().min(1),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);

  const { username, email, password, real_name, date_of_birth } = result.data;
  
  const { data: existing } = await supabase.from('users').select('id').or(`username.eq.${username},email.eq.${email}`).single();
  if (existing) return res.status(400).json({ error: 'Username or email already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: user, error } = await supabase
    .from('users')
    .insert({ username, email, password: hashedPassword, real_name, date_of_birth })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  
  await notifyAllUsers('new_user', user.id, undefined, `New user ${username} joined!`);
  
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ id: user.id, username, email });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  let { email, password } = req.body;
  if (typeof email === 'string') email = email.trim().toLowerCase();
  
  const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ id: user.id, username: user.username, bio: user.bio, avatar_url: user.avatar_url });
});

// Chat history
app.get('/api/chat/:roomId', authenticateToken, async (req: any, res) => {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${req.query.otherUserId}),and(sender_id.eq.${req.query.otherUserId},receiver_id.eq.${req.user.id})`)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(messages);
});

// User's posts
app.get('/api/users/:id/posts', authenticateToken, async (req: any, res) => {
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(username, avatar_url),
      likes:likes(count),
      comments:comments(count)
    `)
    .eq('user_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: userLikes } = await supabase.from('likes').select('post_id').eq('user_id', req.user.id);
  const likedPostIds = new Set(userLikes?.map(l => l.post_id) || []);

  const formattedPosts = posts.map(p => ({
    ...p,
    username: p.user?.username,
    avatar_url: p.user?.avatar_url,
    likes_count: p.likes?.[0]?.count || 0,
    comments_count: p.comments?.[0]?.count || 0,
    is_liked: likedPostIds.has(p.id)
  }));

  res.json(formattedPosts);
});

// Conversations
app.get('/api/chats/conversations', authenticateToken, async (req: any, res) => {
  // This is complex in Supabase without a custom function, but we'll try a simpler version
  // Get all users I've messaged or who messaged me
  const { data: sent } = await supabase.from('messages').select('receiver_id').eq('sender_id', req.user.id);
  const { data: received } = await supabase.from('messages').select('sender_id').eq('receiver_id', req.user.id);
  
  const userIds = Array.from(new Set([
    ...(sent?.map(m => m.receiver_id) || []),
    ...(received?.map(m => m.sender_id) || [])
  ]));

  if (userIds.length === 0) return res.json([]);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, avatar_url, is_verified')
    .in('id', userIds);

  if (error) return res.status(500).json({ error: error.message });
  res.json(users);
});

// Current User
app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  const { data: user, error } = await supabase.from('users').select('*').eq('id', req.user.id).single();
  if (error || !user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Update Profile
app.put('/api/users/profile', authenticateToken, async (req: any, res) => {
  const { username, bio, avatar_url, real_name, date_of_birth } = req.body;
  await supabase.from('users').update({ username, bio, avatar_url, real_name, date_of_birth }).eq('id', req.user.id);
  res.json({ success: true });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});

// Vite Middleware
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
