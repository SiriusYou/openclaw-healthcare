import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getHealthData } from "@/lib/health-data"

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const data = await getHealthData()
  return NextResponse.json(data)
}
