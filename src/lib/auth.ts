import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { prisma } from '@/lib/prisma';

// Session config — short-lived for financial app security
const SESSION_MAX_AGE = 4 * 60 * 60;  // 4 hours
const SESSION_UPDATE_AGE = 15 * 60;    // Refresh token every 15 min of activity

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE, // Sliding window — refresh on activity
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'strict', // Strict CSRF protection (was Lax)
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: '/login',
    newUser: '/login',
    error: '/login',
  },
  providers: [
    // Google OAuth (only if configured)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // GitHub OAuth (only if configured)
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      // Track last activity for idle timeout
      token.lastActivity = Date.now();

      // Encrypt OAuth tokens in the jwt callback (before adapter persists)
      if (account && process.env.ENCRYPTION_KEY) {
        try {
          const { encrypt, isEncrypted } = await import('@/lib/encryption');
          if (account.refresh_token && !isEncrypted(account.refresh_token)) {
            account.refresh_token = encrypt(account.refresh_token);
          }
          if (account.access_token && !isEncrypted(account.access_token)) {
            account.access_token = encrypt(account.access_token);
          }
          if (account.id_token && !isEncrypted(account.id_token)) {
            account.id_token = encrypt(account.id_token);
          }
        } catch {
          // Don't break auth flow if encryption fails
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) || "";
        // Pass last activity to client for idle timeout
        (session as any).lastActivity = token.lastActivity;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Seed default categories for new users
      if (user.id) {
        const defaults = await import('@/lib/defaults');
        await defaults.seedUserDefaults(user.id);
      }
    },
    async signIn({ user }) {
      // Audit login events
      try {
        const { audit } = await import('@/lib/audit');
        await audit('login', user.id);
      } catch {
        // Don't break sign-in if audit fails
      }
    },
  },
});
