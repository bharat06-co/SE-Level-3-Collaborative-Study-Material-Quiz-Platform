module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/config/database.js', '!src/config/logger.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: { global: { lines: 70, statements: 70, functions: 70, branches: 70 } },
  clearMocks: true,
};
