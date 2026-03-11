import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Read Google OAuth config at init time (requires restart after config change)
function getGoogleProvider() {
  try {
    const settingsFile = join(process.cwd(), '..', 'settings.json');
    if (existsSync(settingsFile)) {
      const settings = JSON.parse(readFileSync(settingsFile, 'utf-8'));
      if (settings.googleOAuth?.clientId && settings.googleOAuth?.clientSecret) {
        return Google({
          clientId: settings.googleOAuth.clientId,
          clientSecret: settings.googleOAuth.clientSecret,
        });
      }
    }
  } catch {}
  return null;
}

const googleProvider = getGoogleProvider();

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const config: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { getUserByUsername, initUsersIfNeeded, verifyPassword, updateLastActive } =
          await import('./users');

        initUsersIfNeeded();

        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        const user = getUserByUsername(username);
        if (!user) return null;

        if (!verifyPassword(password, user.passwordHash)) return null;

        // Check account status
        const status = user.status || 'active';
        if (status !== 'active') return null;

        // Track last activity
        updateLastActive(user.id);

        return {
          id: user.id,
          name: user.displayName,
          email: user.email || `${user.username}@local`,
          role: user.role,
        };
      },
    }),
    ...(googleProvider ? [googleProvider] : []),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const { createOrLinkGoogleUser, updateLastActive } = await import('./users');
        const dbUser = createOrLinkGoogleUser({
          googleId: account.providerAccountId,
          email: user.email || '',
          name: user.name || '',
        });

        const status = dbUser.status || 'active';
        if (status !== 'active') {
          return '/login?error=pending';
        }

        // Track last activity
        updateLastActive(dbUser.id);

        // Attach db user info to the user object for jwt callback
        (user as unknown as Record<string, unknown>).id = dbUser.id;
        (user as unknown as Record<string, unknown>).role = dbUser.role;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id =
          ((user as unknown as Record<string, unknown>).id as string) || (user.id as string);
        token.role = ((user as unknown as Record<string, unknown>).role as string) || 'user';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;

      // Allow public pages
      if (PUBLIC_PATHS.some((p) => pathname === p) || pathname.startsWith('/api/auth')) {
        return true;
      }

      // In development without AUTH_ENABLED, skip auth
      if (process.env.NODE_ENV === 'development' && process.env.AUTH_ENABLED !== 'true') {
        return true;
      }

      // Protect everything else
      if (!isLoggedIn) {
        return false;
      }

      // Protect admin routes
      if (pathname.startsWith('/admin')) {
        const role = auth?.user?.role;
        if (role !== 'admin') {
          return Response.redirect(new URL('/', request.nextUrl));
        }
      }

      return true;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
