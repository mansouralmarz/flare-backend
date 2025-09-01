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

// Update user profile
app.put('/api/users/profile', authenticateToken, (req, res) => {
  console.log('Update profile request:', req.body);
  try {
    const { bio, profilePicture } = req.body;

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user fields if provided
    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    if (profilePicture !== undefined) {
      // For now, we'll use the provided URL or generate a new avatar
      if (profilePicture.startsWith('http')) {
        user.profilePicture = profilePicture;
      } else {
        // Generate new avatar based on username
        user.profilePicture = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
      }
    }

    // Update the user in storage
    users.set(user.username, user);

    console.log('Profile updated successfully for:', user.username);

    res.json({
      message: 'Profile updated successfully',
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
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile: ' + error.message });
  }
});

// Get current user profile
app.get('/api/users/me', authenticateToken, (req, res) => {
  try {
    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
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
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error getting profile: ' + error.message });
  }
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
    comments: p.comments,
    participants: p.participants || []
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
      comments: [],
      participants: [user.id] // Author automatically joins
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

// Add comment/reply to post
app.post('/api/posts/:id/comments', authenticateToken, (req, res) => {
  console.log('Add comment request:', req.params.id, req.body);
  try {
    const postId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const post = posts.get(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize comments array if it doesn't exist
    if (!post.comments) {
      post.comments = [];
    }

    const comment = {
      id: Date.now(),
      content: content.trim(),
      authorId: user.id,
      authorUsername: user.username,
      authorProfilePicture: user.profilePicture,
      createdAt: new Date(),
      likes: 0
    };

    post.comments.push(comment);
    posts.set(postId, post);

    console.log('Comment added successfully by:', user.username);

    res.status(201).json({
      message: 'Comment added successfully',
      comment: comment
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error adding comment: ' + error.message });
  }
});

// Get comments for a post
app.get('/api/posts/:id/comments', (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const post = posts.get(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({
      comments: post.comments || []
    });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error getting comments: ' + error.message });
  }
});

// Like/Unlike post
app.post('/api/posts/:id/like', authenticateToken, (req, res) => {
  console.log('Like post request:', req.params.id);
  try {
    const postId = parseInt(req.params.id);
    const post = posts.get(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize likes if it doesn't exist
    if (typeof post.likes !== 'number') {
      post.likes = 0;
    }

    // For simplicity, just increment likes (no unlike functionality for now)
    post.likes += 1;
    posts.set(postId, post);

    console.log('Post liked by:', user.username);

    res.json({
      message: 'Post liked successfully',
      likes: post.likes
    });

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error liking post: ' + error.message });
  }
});

// Join/Leave hotspot
app.post('/api/posts/:id/join', authenticateToken, (req, res) => {
  console.log('Join hotspot request:', req.params.id);
  try {
    const postId = parseInt(req.params.id);
    const post = posts.get(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Hotspot not found' });
    }

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize participants if it doesn't exist
    if (!post.participants) {
      post.participants = [];
    }

    // Check if user already joined
    if (post.participants.includes(user.id)) {
      return res.status(400).json({ message: 'Already joined this hotspot' });
    }

    // Add user to participants
    post.participants.push(user.id);
    posts.set(postId, post);

    console.log('User joined hotspot:', user.username, 'joined', post.title);

    res.json({
      message: 'Joined hotspot successfully',
      participants: post.participants
    });

  } catch (error) {
    console.error('Join hotspot error:', error);
    res.status(500).json({ message: 'Server error joining hotspot: ' + error.message });
  }
});

app.post('/api/posts/:id/leave', authenticateToken, (req, res) => {
  console.log('Leave hotspot request:', req.params.id);
  try {
    const postId = parseInt(req.params.id);
    const post = posts.get(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Hotspot not found' });
    }

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize participants if it doesn't exist
    if (!post.participants) {
      post.participants = [];
    }

    // Check if user is in participants
    const index = post.participants.indexOf(user.id);
    if (index === -1) {
      return res.status(400).json({ message: 'Not joined this hotspot' });
    }

    // Remove user from participants
    post.participants.splice(index, 1);
    posts.set(postId, post);

    console.log('User left hotspot:', user.username, 'left', post.title);

    res.json({
      message: 'Left hotspot successfully',
      participants: post.participants
    });

  } catch (error) {
    console.error('Leave hotspot error:', error);
    res.status(500).json({ message: 'Server error leaving hotspot: ' + error.message });
  }
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
