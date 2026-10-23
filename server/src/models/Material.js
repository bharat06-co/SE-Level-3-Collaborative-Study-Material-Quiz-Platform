const mongoose = require('mongoose');

const MAX_TAGS = 10;
const TAG_MAX_LENGTH = 30;

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    tags: {
      type: [String],
      validate: {
        validator(tags) {
          if (!Array.isArray(tags) || tags.length < 1 || tags.length > MAX_TAGS) return false;
          if (new Set(tags).size !== tags.length) return false;
          return tags.every((tag) => typeof tag === 'string'
            && tag.length >= 1
            && tag.length <= TAG_MAX_LENGTH
            && tag === tag.trim()
            && tag === tag.toLowerCase());
        },
        message: `Tags must contain ${MAX_TAGS} or fewer unique lowercase tags of 1-${TAG_MAX_LENGTH} characters.`,
      },
    },
    fileUrl: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
      unique: false,
    },
    mimeType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    visibility: {
      type: String,
      enum: ['private', 'shared', 'public'],
      default: 'private',
      required: true,
    },
    sharedWith: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    hidden: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'studymaterials',
  },
);

materialSchema.index({ title: 'text', description: 'text', tags: 'text' });
materialSchema.index({ topic: 1 });
materialSchema.index({ ownerId: 1 });
materialSchema.index({ visibility: 1, hidden: 1 });

module.exports = { MAX_TAGS, TAG_MAX_LENGTH, Material: mongoose.model('Material', materialSchema) };
