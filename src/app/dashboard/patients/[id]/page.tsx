import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { mockPatients } from "@/components/patients-list"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const patient = mockPatients.find((p) => p.id === id)

  if (!patient) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Patient Not Found</h2>
        <p className="text-muted-foreground">
          No patient with ID &quot;{id}&quot; was found.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{patient.name}</h2>
        <p className="text-muted-foreground">Patient ID: {patient.id}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
          <CardDescription>Detailed patient record</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Age</dt>
              <dd className="text-lg">{patient.age}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Gender</dt>
              <dd className="text-lg">{patient.gender}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Diagnosis</dt>
              <dd className="text-lg">{patient.diagnosis}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Admission Date</dt>
              <dd className="text-lg">{patient.admissionDate}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
