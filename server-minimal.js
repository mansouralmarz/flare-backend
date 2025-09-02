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
const messages = new Map();
let userIdCounter = 1;
let postIdCounter = 1;
let messageIdCounter = 1;

// JWT middleware
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

// Create persistent demo users that always exist
const createDemoUsers = async () => {
  try {
    // Hash the password properly
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const demoUsers = [
      {
        id: userIdCounter++,
        username: 'demo',
        password: hashedPassword,
        profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
        bio: 'Demo user',
        isAdmin: true,
        joinDate: new Date(),
        isOnline: false
      },
      {
        id: userIdCounter++,
        username: 'testuser',
        password: hashedPassword,
        profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=testuser',
        bio: 'Test user for development',
        isAdmin: false,
        joinDate: new Date(),
        isOnline: false
      },
      {
        id: userIdCounter++,
        username: 'admin',
        password: hashedPassword,
        profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        bio: 'Administrator account',
        isAdmin: true,
        joinDate: new Date(),
        isOnline: false
      }
    ];

    demoUsers.forEach(user => {
      users.set(user.username, user);
    });

    console.log('✅ Demo users created with proper password hash:', demoUsers.map(u => u.username).join(', '));
  } catch (error) {
    console.error('❌ Error creating demo users:', error);
  }
};

// Initialize demo users
createDemoUsers();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Flare Backend is running!',
    timestamp: new Date().toISOString(),
    users: users.size
  });
});

// Access gate
app.post('/api/auth/verify-access', (req, res) => {
  const { password } = req.body;
  if (password === 'flare2024') {
    res.json({ success: true, message: 'Access granted' });
  } else {
    res.status(401).json({ success: false, message: 'Incorrect password' });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, bio } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
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
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const user = users.get(username.toLowerCase());
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    user.isOnline = true;
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      'flare-secret-key-2024',
      { expiresIn: '7d' }
    );

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
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Get users
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
  try {
    const { bio, profilePicture, username } = req.body;

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user fields if provided
    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    if (profilePicture !== undefined) {
      if (profilePicture.startsWith('http')) {
        user.profilePicture = profilePicture;
      } else {
        // Generate new avatar
        user.profilePicture = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
      }
    }

    if (username !== undefined && username.trim() !== user.username) {
      const newUsername = username.trim().toLowerCase();
      if (users.has(newUsername)) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      // Remove old username key and add new one
      users.delete(user.username);
      user.username = newUsername;
      users.set(newUsername, user);
    }

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
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Admin: Update user
app.put('/api/users/:id', authenticateToken, (req, res) => {
  try {
    const currentUser = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!currentUser || !currentUser.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const targetUserId = parseInt(req.params.id);
    const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
    
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { isAdmin, bio, username } = req.body;

    if (isAdmin !== undefined) {
      targetUser.isAdmin = isAdmin;
    }

    if (bio !== undefined) {
      targetUser.bio = bio.trim();
    }

    if (username !== undefined && username.trim() !== targetUser.username) {
      const newUsername = username.trim().toLowerCase();
      if (users.has(newUsername)) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      users.delete(targetUser.username);
      targetUser.username = newUsername;
      users.set(newUsername, targetUser);
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: targetUser.id,
        username: targetUser.username,
        profilePicture: targetUser.profilePicture,
        bio: targetUser.bio,
        isAdmin: targetUser.isAdmin,
        joinDate: targetUser.joinDate,
        isOnline: targetUser.isOnline
      }
    });

  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Admin: Delete user
app.delete('/api/users/:id', authenticateToken, (req, res) => {
  try {
    const currentUser = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!currentUser || !currentUser.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const targetUserId = parseInt(req.params.id);
    const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
    
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.id === currentUser.id) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    users.delete(targetUser.username);

    res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Get user stats
app.get('/api/users/stats', authenticateToken, (req, res) => {
  try {
    const currentUser = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!currentUser || !currentUser.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const allUsers = Array.from(users.values());
    const stats = {
      totalUsers: allUsers.length,
      totalAdmins: allUsers.filter(u => u.isAdmin).length,
      recentSignups: allUsers.filter(u => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return new Date(u.joinDate) > dayAgo;
      }).length
    };

    res.json({ stats });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Get posts
app.get('/api/posts', (req, res) => {
  const postsList = Array.from(posts.values()).map(p => ({
    id: p.id,
    title: p.title,
    content: p.content,
    location: p.location,
    images: p.images || [], // Include images array
    authorId: p.authorId,
    authorUsername: p.authorUsername,
    createdAt: p.createdAt,
    likes: p.likes || 0,
    likedBy: p.likedBy || [], // Include who liked the post
    comments: p.comments || [],
    participants: p.participants || []
  }));
  res.json({ posts: postsList });
});

// Create post
app.post('/api/posts', authenticateToken, (req, res) => {
  try {
    const { title, content, location, images } = req.body;

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
      images: images || [], // Store images array
      authorId: user.id,
      authorUsername: user.username,
      createdAt: new Date(),
      likes: 0,
      likedBy: [],
      comments: [],
      participants: [user.id]
    };

    posts.set(post.id, post);

    res.status(201).json({
      message: 'Post created successfully',
      post: post
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Join/Leave hotspot
app.post('/api/posts/:id/join', authenticateToken, (req, res) => {
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

    if (!post.participants) {
      post.participants = [];
    }

    if (post.participants.includes(user.id)) {
      return res.status(400).json({ message: 'Already joined this hotspot' });
    }

    post.participants.push(user.id);
    posts.set(postId, post);

    res.json({
      message: 'Joined hotspot successfully',
      participants: post.participants
    });

  } catch (error) {
    console.error('Join hotspot error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

app.post('/api/posts/:id/leave', authenticateToken, (req, res) => {
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

    if (!post.participants) {
      post.participants = [];
    }

    const index = post.participants.indexOf(user.id);
    if (index === -1) {
      return res.status(400).json({ message: 'Not joined this hotspot' });
    }

    post.participants.splice(index, 1);
    posts.set(postId, post);

    res.json({
      message: 'Left hotspot successfully',
      participants: post.participants
    });

  } catch (error) {
    console.error('Leave hotspot error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Like/Unlike post (toggle functionality)
app.post('/api/posts/:id/like', authenticateToken, (req, res) => {
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

    // Initialize likes array if it doesn't exist
    if (!post.likedBy) {
      post.likedBy = [];
    }

    const userId = user.id;
    const hasLiked = post.likedBy.includes(userId);

    if (hasLiked) {
      // Unlike: Remove user from likedBy and decrement likes
      post.likedBy = post.likedBy.filter(id => id !== userId);
      post.likes = Math.max(0, post.likes - 1);
      posts.set(postId, post);

      console.log('User unliked post:', user.username);
      res.json({
        message: 'Post unliked successfully',
        liked: false,
        likes: post.likes
      });
    } else {
      // Like: Add user to likedBy and increment likes
      post.likedBy.push(userId);
      post.likes = (post.likes || 0) + 1;
      posts.set(postId, post);

      console.log('User liked post:', user.username);
      res.json({
        message: 'Post liked successfully',
        liked: true,
        likes: post.likes
      });
    }

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Add comment to post
app.post('/api/posts/:id/comments', authenticateToken, (req, res) => {
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

    res.status(201).json({
      message: 'Comment added successfully',
      comment: comment
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
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
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Delete post/hotspot
app.delete('/api/posts/:id', authenticateToken, (req, res) => {
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

    // Only post author or admin can delete
    if (post.authorId !== user.id && !user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    posts.delete(postId);

    console.log('Post deleted successfully by:', user.username);

    res.json({
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Get all messages
app.get('/api/messages', authenticateToken, (req, res) => {
  try {
    const messagesList = Array.from(messages.values()).map(m => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      senderUsername: m.senderUsername,
      senderProfilePicture: m.senderProfilePicture,
      recipientId: m.recipientId,
      recipientUsername: m.recipientUsername,
      timestamp: m.timestamp,
      type: m.type
    }));
    
    // Sort by timestamp (newest first)
    messagesList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ messages: messagesList });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Send message
app.post('/api/messages', authenticateToken, (req, res) => {
  try {
    const { content, recipientId, recipientUsername } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const message = {
      id: messageIdCounter++,
      content: content.trim(),
      senderId: user.id,
      senderUsername: user.username,
      senderProfilePicture: user.profilePicture,
      recipientId: recipientId || null,
      recipientUsername: recipientUsername || null,
      timestamp: new Date(),
      type: recipientId ? 'direct' : 'public'
    };

    messages.set(message.id, message);

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Get messages for a specific user (DMs)
app.get('/api/messages/:userId', authenticateToken, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    const currentUserId = req.user.userId;
    
    const messagesList = Array.from(messages.values()).filter(m => 
      (m.senderId === currentUserId && m.recipientId === targetUserId) ||
      (m.senderId === targetUserId && m.recipientId === currentUserId)
    );
    
    // Sort by timestamp (oldest first for conversation)
    messagesList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({ messages: messagesList });
  } catch (error) {
    console.error('Get user messages error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Delete message
app.delete('/api/messages/:id', authenticateToken, (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const message = messages.get(messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only sender or admin can delete message
    if (message.senderId !== user.id && !user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    messages.delete(messageId);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found: ' + req.originalUrl });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Server error: ' + err.message });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Flare Backend running on port ${PORT}`);
  console.log(`👥 Demo users available:`);
  console.log(`   - demo / password123 (admin)`);
  console.log(`   - testuser / password123 (user)`);
  console.log(`   - admin / password123 (admin)`);
  console.log(`🔑 Access code: flare2024`);
});
