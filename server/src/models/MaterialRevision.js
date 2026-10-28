const mongoose = require('mongoose');

const materialRevisionSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },
    versionNo: {
      type: Number,
      required: true,
      min: 1,
    },
    editorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    fileUrl: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'materialrevisions',
  },
);

materialRevisionSchema.index({ materialId: 1, versionNo: 1 }, { unique: true });

module.exports = mongoose.model('MaterialRevision', materialRevisionSchema);
