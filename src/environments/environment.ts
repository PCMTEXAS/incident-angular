/*
 * Development environment configuration.
 *
 * All sensitive values are injected at build time via Angular's
 * `fileReplacements` (see angular.json) or via a custom build script.
 *
 * For local development, create a `.env` file at the project root
 * (see `.env.example`) and run the `npm run config` script before
 * `ng serve` to generate this file with real values.
 *
 * NEVER commit real keys to source control.
 */
export const environment = {
  production: false,
  supabaseUrl: 'SUPABASE_URL_PLACEHOLDER',
  supabaseKey: 'SUPABASE_ANON_KEY_PLACEHOLDER',
};
