const { z } = require('zod');
const { AppError } = require('../../utils/AppError');
const { validatePlainText } = require('../../utils/plainText');
const { REPORT_REASONS, REPORT_STATUSES } = require('../../models/MaterialReport');

const DEFAULT_RATE_LIMIT = Object.freeze({ limit: 10, windowMs: 60 * 60 * 1000 });

const createReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: z.string().optional(),
}).strict();

const decisionSchema = z.object({
  decision: z.enum(['dismiss', 'uphold']),
}).strict();

const queueQuerySchema = z.object({
  status: z.enum(REPORT_STATUSES).default('open'),
}).strict();

function validationDetails(zodError) {
  return zodError.issues.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));
}

function requireAdmin(auth) {
  if (!auth || auth.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access is required.');
  }
}

function requireReportId(id) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [
      { field: 'id', message: 'Report ID is invalid.' },
    ]);
  }
}

function personView(person) {
  if (!person) return null;
  if (typeof person === 'object' && person.name !== undefined) {
    return { id: person._id.toString(), name: person.name };
  }
  return { id: String(person), name: '' };
}

function reportView(report) {
  const material = report.materialId && typeof report.materialId === 'object'
    ? report.materialId
    : null;

  return {
    id: report._id.toString(),
    materialId: material ? material._id.toString() : String(report.materialId),
    materialTitle: material?.title,
    reporter: personView(report.reporterId),
    reason: report.reason,
    note: report.note || '',
    status: report.status,
    reviewer: personView(report.reviewerId),
    createdAt: report.createdAt,
    decidedAt: report.decidedAt || null,
  };
}

function createReportService({ reportRepository, materialRepository, materialService, rateLimit = DEFAULT_RATE_LIMIT } = {}) {
  if (!reportRepository || !materialRepository || !materialService) {
    throw new Error('Report service requires report/material repositories and the material service.');
  }

  async function setHidden(materialId, hidden) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const document = await materialRepository.findById(materialId);
      if (!document) return null;
      const updated = await materialRepository.updateIfVersion(materialId, document.__v, { hidden });
      if (updated) return updated;
    }
    throw new AppError(409, 'MATERIAL_CONFLICT', 'Material changed during this request. Please retry.');
  }

  async function createReport(auth, materialId, input) {
    const document = await materialService.getMaterialForReporting(auth, materialId);

    if (auth.role === 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'Administrators review reports and cannot submit them.');
    }

    const parsed = createReportSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(parsed.error));
    }

    const since = new Date(Date.now() - rateLimit.windowMs);
    const recentReports = await reportRepository.countByReporterSince(auth.userId, since);
    if (recentReports >= rateLimit.limit) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many reports were submitted. Try again later.');
    }

    const existing = await reportRepository.findOpenByReporter(materialId, auth.userId);
    if (existing) {
      throw new AppError(409, 'REPORT_EXISTS', 'You already have an open report for this material.');
    }

    const note = parsed.data.note && parsed.data.note.trim().length > 0
      ? validatePlainText(parsed.data.note, { field: 'note', minLength: 1, maxLength: 1000 })
      : '';

    let report;
    try {
      report = await reportRepository.create({
        materialId: document._id,
        reporterId: auth.userId,
        reason: parsed.data.reason,
        note,
        status: 'open',
      });
    } catch (error) {
      if (error?.code === 11000) {
        throw new AppError(409, 'REPORT_EXISTS', 'You already have an open report for this material.');
      }
      throw error;
    }

    try {
      await setHidden(document._id, true);
    } catch (error) {
      await reportRepository.remove(report._id).catch(() => {});
      throw error;
    }

    return reportView(report);
  }

  async function listReports(auth, queryInput) {
    requireAdmin(auth);

    const parsed = queueQuerySchema.safeParse(queryInput || {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(parsed.error));
    }

    const reports = await reportRepository.listByStatus(parsed.data.status);
    return { items: reports.map(reportView) };
  }

  async function decideReport(auth, reportId, input) {
    requireAdmin(auth);
    requireReportId(reportId);

    const parsed = decisionSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(parsed.error));
    }

    const existing = await reportRepository.findById(reportId);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Report not found.');
    }
    if (existing.status !== 'open') {
      throw new AppError(409, 'REPORT_ALREADY_RESOLVED', 'This report has already been resolved.');
    }

    const status = parsed.data.decision === 'dismiss' ? 'dismissed' : 'actioned';
    const report = await reportRepository.decide(reportId, {
      status,
      reviewerId: auth.userId,
      decidedAt: new Date(),
    });
    if (!report) {
      throw new AppError(409, 'REPORT_ALREADY_RESOLVED', 'This report has already been resolved.');
    }

    const materialId = report.materialId?._id || report.materialId;
    if (status === 'dismissed') {
      const otherOpen = await reportRepository.countOtherOpen(materialId, report._id);
      if (otherOpen === 0) {
        await setHidden(materialId, false);
      }
    } else {
      await setHidden(materialId, true);
    }

    return reportView(report);
  }

  return { createReport, listReports, decideReport };
}

module.exports = { createReportService, DEFAULT_RATE_LIMIT };
