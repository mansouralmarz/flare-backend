const mongoose = require('mongoose');

const hotspotSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coordinates: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    }
  },
  joinedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for joined user count
hotspotSchema.virtual('joinedCount').get(function() {
  return this.joinedUsers.length;
});

// Ensure virtual fields are serialized
hotspotSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Hotspot', hotspotSchema);
