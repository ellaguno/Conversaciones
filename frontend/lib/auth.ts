import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // In development, accept the configured admin user or any user if not configured
        const adminUser = process.env.AUTH_ADMIN_USER || 'admin';
        const adminPass = process.env.AUTH_ADMIN_PASSWORD || 'admin';

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
