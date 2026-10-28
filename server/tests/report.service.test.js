const { createReportService } = require('../src/modules/moderation/report.service');

function setup(overrides = {}) {
  const reportRepository = {
    create: jest.fn(async (report) => ({ _id: 'r1', createdAt: new Date(), ...report })),
    findById: jest.fn(),
    findOpenByReporter: jest.fn().mockResolvedValue(null),
    countByReporterSince: jest.fn().mockResolvedValue(0),
    listByStatus: jest.fn(),
    countOtherOpen: jest.fn(),
    decide: jest.fn(),
    remove: jest.fn().mockResolvedValue({}),
    ...overrides.reportRepository,
  };
  const materialRepository = {
    findById: jest.fn().mockResolvedValue({ _id: 'm1', __v: 0 }),
    updateIfVersion: jest.fn().mockResolvedValue({ _id: 'm1', hidden: true }),
    ...overrides.materialRepository,
  };
  const materialService = {
    getMaterialForReporting: jest.fn().mockResolvedValue({ _id: 'm1' }),
    ...overrides.materialService,
  };
  return {
    reportRepository,
    materialRepository,
    materialService,
    service: createReportService({
      reportRepository,
      materialRepository,
      materialService,
      rateLimit: overrides.rateLimit,
    }),
  };
}

const auth = { userId: 'u1', role: 'student' };

test('rate limit stops report creation before persistence', async () => {
  const { service, reportRepository } = setup({
    rateLimit: { limit: 2, windowMs: 60000 },
    reportRepository: { countByReporterSince: jest.fn().mockResolvedValue(2) },
  });

  await expect(service.createReport(auth, 'm1', { reason: 'spam' })).rejects.toMatchObject({
    statusCode: 429,
    code: 'RATE_LIMITED',
  });
  expect(reportRepository.create).not.toHaveBeenCalled();
  expect(reportRepository.findOpenByReporter).not.toHaveBeenCalled();
});

test('hiding failure removes the newly created report', async () => {
  const { service, reportRepository } = setup({
    materialRepository: {
      findById: jest.fn().mockResolvedValue({ _id: 'm1', __v: 0 }),
      updateIfVersion: jest.fn().mockResolvedValue(null),
    },
  });

  await expect(service.createReport(auth, 'm1', { reason: 'spam' })).rejects.toMatchObject({
    statusCode: 409,
    code: 'MATERIAL_CONFLICT',
  });
  expect(reportRepository.remove).toHaveBeenCalledWith('r1');
});

test('overlong notes are rejected without persisting', async () => {
  const { service, reportRepository } = setup();
  await expect(service.createReport(auth, 'm1', { reason: 'spam', note: 'x'.repeat(1001) })).rejects.toMatchObject({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
  });
  expect(reportRepository.create).not.toHaveBeenCalled();
});
