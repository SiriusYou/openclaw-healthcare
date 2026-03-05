import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

const DEMO_USERS = [
  {
    id: "1",
    name: "Admin",
    email: "admin@openclaw.com",
    password: "admin123",
  },
] as const

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string
        const password = credentials?.password as string

        const user = DEMO_USERS.find(
          (u) => u.email === email && u.password === password
        )

        if (!user) return null

        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard")

      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false
      }

      if (isLoggedIn && nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }

      return true
    },
  },
})
