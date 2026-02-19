/** @type {import('jest').Config} */
module.exports = {
  displayName: 'client-app',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          // minimal tsconfig override for test environment
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testRegex: '\\.test\\.(ts|tsx)$',
  // Pure function tests live under src/**/__tests__/
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // 'use client' is just a string — no special handling needed
};
