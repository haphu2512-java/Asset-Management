import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
/** The mobile app's source, shared with the web app: calculations, sync and the data store. */
const shared = path.resolve(here, '../src');

/**
 * The shared store imports `./supabase`, which on mobile reads env vars and uses AsyncStorage.
 * On the web it is swapped for a client that keeps the session in localStorage.
 */
function webSupabase(): Plugin {
  const target = path.resolve(here, 'src/supabase.ts');
  return {
    name: 'web-supabase',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !importer.startsWith(shared)) return null;
      if (source === './supabase' || source === './supabase.ts') return target;
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  // Accept the same variable names as the mobile app, or VITE_ ones.
  const env = loadEnv(mode, here, ['VITE_', 'EXPO_PUBLIC_']);
  const url = env.VITE_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key =
    env.VITE_SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  return {
    plugins: [webSupabase(), react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(url),
      __SUPABASE_ANON_KEY__: JSON.stringify(key),
    },
    resolve: {
      alias: [
        { find: /^react-native$/, replacement: path.resolve(here, 'src/shims/react-native.ts') },
        {
          find: /^@react-native-async-storage\/async-storage$/,
          replacement: path.resolve(here, 'src/shims/async-storage.ts'),
        },
        { find: '@shared', replacement: shared },
      ],
      // Shared files live outside this folder; make their bare imports use this app's packages.
      dedupe: ['react', 'react-dom', '@supabase/supabase-js'],
    },
    // The shared files sit under the mobile app's tsconfig, which extends an Expo preset that is
    // not installed here; give esbuild its settings directly (as a string, so no tsconfig is read).
    esbuild: {
      tsconfigRaw: JSON.stringify({ compilerOptions: { jsx: 'react-jsx', target: 'ES2022', useDefineForClassFields: true } }),
    },
    server: { fs: { allow: [path.resolve(here, '..')] } },
    build: { chunkSizeWarningLimit: 1200 },
  };
});
