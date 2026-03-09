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
        // Dynamic import to avoid Node.js APIs in Edge Runtime (middleware)
        const { getUserByUsername, initUsersIfNeeded, verifyPassword } = await import('./users');

        // Ensure users.json exists with seed admin on first run
        initUsersIfNeeded();

        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        const user = getUserByUsername(username);
        if (!user) return null;

        if (!verifyPassword(password, user.passwordHash)) return null;

        return {
          id: user.id,
          name: user.displayName,
          email: `${user.username}@local`,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      // On sign-in, persist id and role into the JWT
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role || 'user';
      }
      return token;
    },
    session({ session, token }) {
      // Expose id and role on the session object
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
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

      // Protect admin routes
      if (request.nextUrl.pathname.startsWith('/admin')) {
        const role = auth?.user?.role;
        if (role !== 'admin') {
          return Response.redirect(new URL('/', request.nextUrl));
        }
      }

      return true;
    },
  },
});
