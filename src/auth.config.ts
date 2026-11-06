import type { NextAuthConfig } from "next-auth";

const MASTER_ADMIN_EMAILS = [
    "admin@nexus.com",
    "lucasmeloil@pm.me"
];

function isMasterEmail(email?: string | null): boolean {
    if (!email) return false;
    const clean = email.toLowerCase().trim();
    return MASTER_ADMIN_EMAILS.some(e => e.toLowerCase() === clean);
}

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
            if (isMasterEmail(token.email as string)) {
                token.role = "SUPERADMIN";
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                const isMaster = isMasterEmail(token.email as string) || isMasterEmail(session.user.email);
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
