/*
 * Production environment configuration.
 *
 * Real values are injected during CI/CD builds via environment
 * variables. See `scripts/set-env.js` and the `.env.example` file.
 *
 * NEVER commit real keys to source control.
 */
export const environment = {
  production: true,
  supabaseUrl: 'SUPABASE_URL_PLACEHOLDER',
  supabaseKey: 'SUPABASE_ANON_KEY_PLACEHOLDER',
};
