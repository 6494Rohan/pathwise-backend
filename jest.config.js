module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/amplify'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true, strict: true, skipLibCheck: true, types: ['node', 'jest'] } }],
  },
  moduleNameMapper: { '\\.pem$': '<rootDir>/src/test-utils/fileMock.js' },
};
