module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.test.{js,jsx}'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: { '\\.(css)$': '<rootDir>/tests/styleMock.cjs' },
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/main.jsx'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: { global: { lines: 70, statements: 70, functions: 70, branches: 70 } },
  clearMocks: true,
};
