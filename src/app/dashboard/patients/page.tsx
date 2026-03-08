import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PatientsList } from "@/components/patients-list"

export default async function PatientsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Patient Management</h2>
        <p className="text-muted-foreground">
          View and manage all patient records.
        </p>
      </div>

      <PatientsList />
    </div>
  )
}
