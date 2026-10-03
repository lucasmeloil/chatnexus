import type { NextAuthConfig } from "next-auth";

const MASTER_ADMIN_EMAIL = "lucasmeloil@pm.me";

export const authConfig = {
    pages: {
        signIn: '/auth/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            } else if (isLoggedIn && nextUrl.pathname === '/auth/login') {
                return Response.redirect(new URL('/dashboard', nextUrl));
            }
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.email = user.email;
            }
            if (token.email && token.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
                token.role = "SUPERADMIN";
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                const isMaster = (token.email && token.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) || 
                                 (session.user.email && session.user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase());
                (session.user as any).role = isMaster ? "SUPERADMIN" : token.role;
            }
            return session;
        }
    },
    providers: [], // Configured in auth.ts
    session: {
        strategy: 'jwt'
    },
    trustHost: true,
} satisfies NextAuthConfig;
