import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../backend/openapi.json',
  output: 'lib/api-generated',
  plugins: [
    '@hey-api/client-fetch',
    {
      name: '@hey-api/typescript',
    },
  ],
});