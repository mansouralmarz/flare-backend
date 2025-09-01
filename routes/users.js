const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all users (People page)
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ joinDate: -1 });

    res.json({
      users: users.map(user => ({
        id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isAdmin: user.isAdmin,
        isOnline: user.isOnline,
        joinDate: user.joinDate,
        lastSeen: user.lastSeen
      }))
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Get user profile
router.get('/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      username: user.username,
      profilePicture: user.profilePicture,
      bio: user.bio,
      isAdmin: user.isAdmin,
      isOnline: user.isOnline,
      joinDate: user.joinDate,
      lastSeen: user.lastSeen
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { profilePicture, bio } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    // Emit real-time event
    req.io?.emit('userProfileUpdate', {
      userId: user._id,
      profilePicture: user.profilePicture,
      bio: user.bio
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isAdmin: user.isAdmin,
        joinDate: user.joinDate
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Delete user (admin only)
router.delete('/:userId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const userToDelete = await User.findById(req.params.userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow deleting other admins
    if (userToDelete.isAdmin && !req.params.userId === req.user.userId) {
      return res.status(403).json({ message: 'Cannot delete other admin users' });
    }

    await User.findByIdAndDelete(req.params.userId);

    // Emit real-time event
    req.io?.emit('userDeleted', {
      userId: req.params.userId
    });

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

module.exports = router;
