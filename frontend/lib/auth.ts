import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function getAuthPassword(): string {
  const configFile = join(process.cwd(), '..', 'auth-config.json');
  if (existsSync(configFile)) {
    try {
      const data = JSON.parse(readFileSync(configFile, 'utf-8'));
      if (data.password) return data.password;
    } catch {}
  }
  return process.env.AUTH_ADMIN_PASSWORD || 'admin';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const adminUser = process.env.AUTH_ADMIN_USER || 'admin';
        const adminPass = getAuthPassword();

        if (credentials?.username === adminUser && credentials?.password === adminPass) {
          return {
            id: '1',
            name: adminUser,
            email: `${adminUser}@local`,
          };
        }

        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = request.nextUrl.pathname === '/login';
      const isApi = request.nextUrl.pathname.startsWith('/api');

      // Always allow login page and auth API routes
      if (isLoginPage || request.nextUrl.pathname.startsWith('/api/auth')) {
        return true;
      }

      // In development without AUTH_ENABLED, skip auth
      if (process.env.NODE_ENV === 'development' && process.env.AUTH_ENABLED !== 'true') {
        return true;
      }

      // Protect everything else
      if (!isLoggedIn) {
        return false; // Redirect to login
      }

      return true;
    },
  },
});
