import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

const operatorEmail = process.env.OPERATOR_EMAIL ?? "admin@example.com"
const operatorPassword = process.env.OPERATOR_PASSWORD ?? "change-me"

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

        if (email === operatorEmail && password === operatorPassword) {
          return { id: "1", name: "Operator", email }
        }

        return null
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
