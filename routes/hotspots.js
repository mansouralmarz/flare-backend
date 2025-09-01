const express = require('express');
const { body, validationResult } = require('express-validator');
const Hotspot = require('../models/Hotspot');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all hotspots
router.get('/', auth, async (req, res) => {
  try {
    const hotspots = await Hotspot.find()
      .populate('author', 'username profilePicture isAdmin')
      .populate('joinedUsers', 'username profilePicture')
      .sort({ createdAt: -1 });

    // Add user-specific join status
    const hotspotsWithJoinStatus = hotspots.map(hotspot => {
      const hotspotObj = hotspot.toJSON();
      hotspotObj.isJoinedByUser = hotspot.joinedUsers.some(user => 
        user._id.toString() === req.user.userId.toString()
      );
      return hotspotObj;
    });

    res.json({ hotspots: hotspotsWithJoinStatus });

  } catch (error) {
    console.error('Get hotspots error:', error);
    res.status(500).json({ message: 'Error fetching hotspots' });
  }
});

// Create a new hotspot
router.post('/', [
  auth,
  body('title')
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('description')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Description must be between 1 and 1000 characters'),
  body('coordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude required'),
  body('coordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, coordinates } = req.body;

    const hotspot = new Hotspot({
      title,
      description,
      author: req.user.userId,
      coordinates
    });

    await hotspot.save();
    await hotspot.populate('author', 'username profilePicture isAdmin');

    // Emit real-time event
    req.io?.emit('newHotspot', {
      ...hotspot.toJSON(),
      isJoinedByUser: false
    });

    res.status(201).json({
      message: 'Hotspot created successfully',
      hotspot: {
        ...hotspot.toJSON(),
        isJoinedByUser: false
      }
    });

  } catch (error) {
    console.error('Create hotspot error:', error);
    res.status(500).json({ message: 'Error creating hotspot' });
  }
});

// Join/leave a hotspot
router.post('/:hotspotId/join', auth, async (req, res) => {
  try {
    const hotspot = await Hotspot.findById(req.params.hotspotId);
    if (!hotspot) {
      return res.status(404).json({ message: 'Hotspot not found' });
    }

    const userId = req.user.userId;
    const isJoined = hotspot.joinedUsers.includes(userId);

    if (isJoined) {
      // Leave
      hotspot.joinedUsers = hotspot.joinedUsers.filter(id => !id.equals(userId));
    } else {
      // Join
      hotspot.joinedUsers.push(userId);
    }

    await hotspot.save();
    await hotspot.populate('joinedUsers', 'username profilePicture');

    // Emit real-time event
    req.io?.emit('hotspotJoinUpdate', {
      hotspotId: hotspot._id,
      joinedUsers: hotspot.joinedUsers,
      joinedCount: hotspot.joinedUsers.length,
      userId,
      action: isJoined ? 'leave' : 'join'
    });

    res.json({
      message: isJoined ? 'Left hotspot' : 'Joined hotspot',
      joinedCount: hotspot.joinedUsers.length,
      isJoined: !isJoined,
      joinedUsers: hotspot.joinedUsers
    });

  } catch (error) {
    console.error('Join hotspot error:', error);
    res.status(500).json({ message: 'Error updating join status' });
  }
});

// Delete hotspot (author or admin only)
router.delete('/:hotspotId', auth, async (req, res) => {
  try {
    const hotspot = await Hotspot.findById(req.params.hotspotId).populate('author');
    if (!hotspot) {
      return res.status(404).json({ message: 'Hotspot not found' });
    }

    // Check if user is author or admin
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    if (!hotspot.author._id.equals(req.user.userId) && !user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this hotspot' });
    }

    await Hotspot.findByIdAndDelete(req.params.hotspotId);

    // Emit real-time event
    req.io?.emit('hotspotDeleted', {
      hotspotId: req.params.hotspotId
    });

    res.json({ message: 'Hotspot deleted successfully' });

  } catch (error) {
    console.error('Delete hotspot error:', error);
    res.status(500).json({ message: 'Error deleting hotspot' });
  }
});

module.exports = router;
