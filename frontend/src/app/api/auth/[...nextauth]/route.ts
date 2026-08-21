import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { storage } from "@/lib/storage";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "trader@vanguard.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        // Custom simple login logic (since we want an easy flow for the demo)
        const user = await storage.user.findUnique({
          where: { email: credentials.email }
        });

        // Let users "register" by logging in with a new email for this demo
        if (!user) {
          return await storage.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split('@')[0],
              bio: "Quantitative Trader",
            }
          });
        }

        // Extremely simplified check: if email exists, log them in. 
        // Note: For a real production app, use bcrypt to hash and check the password.
        return user;
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub; // Inject user ID directly into the session object
      }
      return session;
    }
  }
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
