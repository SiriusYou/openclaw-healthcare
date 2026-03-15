// TODO: Migrate to Next.js "proxy" convention when NextAuth officially supports it.
// Current warning is non-blocking. See: https://nextjs.org/docs/messages/middleware-upgrade-guide
export { auth as middleware } from "@/lib/auth"

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
