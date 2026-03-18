import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../backend/openapi.json',
  output: 'lib/api-generated',
  client: '@hey-api/client-fetch',
  types: {
    dates: true,
  }
});
