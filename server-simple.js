const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// In-memory storage
const users = new Map();
const posts = new Map();
let userIdCounter = 1;
let postIdCounter = 1;

// Demo user for testing
const demoUser = {
  id: userIdCounter++,
  username: 'demo',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3ZxQQxq6Hy', // "password123"
  profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
  bio: 'Demo user',
  isAdmin: true,
  joinDate: new Date(),
  isOnline: false
};
users.set('demo', demoUser);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Flare Backend is running!',
    timestamp: new Date().toISOString(),
    users: users.size
  });
});

// Gatekeeper password
app.post('/api/auth/verify-access', (req, res) => {
  console.log('Password verification request:', req.body);
  const { password } = req.body;
  const GATEKEEPER_PASSWORD = 'flare2024';

  if (password === GATEKEEPER_PASSWORD) {
    res.json({ success: true, message: 'Access granted' });
  } else {
    res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
  }
});

// User registration
app.post('/api/auth/register', async (req, res) => {
  console.log('Registration request:', req.body);
  try {
    const { username, password, bio } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (users.has(username.toLowerCase())) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      id: userIdCounter++,
      username: username.toLowerCase(),
      password: hashedPassword,
      profilePicture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      bio: bio || '',
      isAdmin: false,
      joinDate: new Date(),
      isOnline: true
    };

    users.set(username.toLowerCase(), user);

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      'flare-secret-key-2024',
      { expiresIn: '7d' }
    );

    console.log('User registered successfully:', user.username);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isAdmin: user.isAdmin,
        joinDate: user.joinDate
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration: ' + error.message });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  console.log('Login request:', req.body);
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const user = users.get(username.toLowerCase());
    if (!user) {
      console.log('User not found:', username);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for user:', username);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    user.isOnline = true;
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      'flare-secret-key-2024',
      { expiresIn: '7d' }
    );

    console.log('User logged in successfully:', user.username);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isAdmin: user.isAdmin,
        joinDate: user.joinDate,
        isOnline: user.isOnline
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login: ' + error.message });
  }
});

// Get all users
app.get('/api/users', (req, res) => {
  const usersList = Array.from(users.values()).map(u => ({
    id: u.id,
    username: u.username,
    profilePicture: u.profilePicture,
    bio: u.bio,
    isAdmin: u.isAdmin,
    isOnline: u.isOnline,
    joinDate: u.joinDate
  }));
  res.json({ users: usersList });
});

// JWT middleware for protected routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, 'flare-secret-key-2024', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Get all posts
app.get('/api/posts', (req, res) => {
  const postsList = Array.from(posts.values()).map(p => ({
    id: p.id,
    title: p.title,
    content: p.content,
    location: p.location,
    authorId: p.authorId,
    authorUsername: p.authorUsername,
    createdAt: p.createdAt,
    likes: p.likes,
    comments: p.comments
  }));
  res.json({ posts: postsList });
});

// Create a new post/hotspot
app.post('/api/posts', authenticateToken, (req, res) => {
  console.log('Create post request:', req.body);
  try {
    const { title, content, location } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const post = {
      id: postIdCounter++,
      title: title.trim(),
      content: content.trim(),
      location: location?.trim() || '',
      authorId: user.id,
      authorUsername: user.username,
      createdAt: new Date(),
      likes: 0,
      comments: []
    };

    posts.set(post.id, post);

    console.log('Post created successfully:', post.title);

    res.status(201).json({
      message: 'Post created successfully',
      post: post
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error creating post: ' + error.message });
  }
});

// Get messages (for chat)
app.get('/api/messages', (req, res) => {
  res.json({ messages: [] });
});

// Send message (for chat)
app.post('/api/messages', authenticateToken, (req, res) => {
  console.log('Send message request:', req.body);
  try {
    const { content, recipientId } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const message = {
      id: Date.now(),
      content: content.trim(),
      senderId: user.id,
      senderUsername: user.username,
      recipientId: recipientId || null,
      timestamp: new Date(),
      type: recipientId ? 'direct' : 'public'
    };

    console.log('Message sent successfully from:', user.username);

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error sending message: ' + error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: 'Server error: ' + err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found: ' + req.originalUrl });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Flare Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`👥 Demo user available: username=demo, password=password123`);
});
