module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|webp|wav)$': '<rootDir>/__mocks__/fileMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
