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
        // authorize() only runs in Node.js runtime (API route), never in Edge middleware
        const adminUser = process.env.AUTH_ADMIN_USER || 'admin';
        let adminPass = process.env.AUTH_ADMIN_PASSWORD || 'admin';

        // Try reading password from config file (written by password change API)
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const fs = require('fs');
          const configFile = process.env.AUTH_CONFIG_PATH || '../auth-config.json';
          if (fs.existsSync(configFile)) {
            const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            if (data.password) adminPass = data.password;
          }
        } catch {}

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
