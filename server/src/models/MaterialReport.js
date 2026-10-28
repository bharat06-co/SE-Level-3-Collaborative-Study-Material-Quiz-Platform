const mongoose = require('mongoose');

const REPORT_REASONS = ['copyright', 'spam', 'inappropriate', 'misleading', 'other'];
const REPORT_STATUSES = ['open', 'dismissed', 'actioned'];

const materialReportSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },
    note: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'open',
      required: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'materialreports',
  },
);

materialReportSchema.index({ status: 1, createdAt: 1 });
materialReportSchema.index(
  { materialId: 1, reporterId: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } },
);

const MaterialReport = mongoose.model('MaterialReport', materialReportSchema);

module.exports = { MaterialReport, REPORT_REASONS, REPORT_STATUSES };
