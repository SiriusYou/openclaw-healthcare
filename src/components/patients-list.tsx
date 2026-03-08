"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface Patient {
  readonly id: string
  readonly name: string
  readonly age: number
  readonly gender: "Male" | "Female"
  readonly diagnosis: string
  readonly admissionDate: string
}

export const mockPatients: readonly Patient[] = [
  {
    id: "P001",
    name: "Zhang Wei",
    age: 45,
    gender: "Male",
    diagnosis: "Type 2 Diabetes",
    admissionDate: "2026-02-15",
  },
  {
    id: "P002",
    name: "Li Na",
    age: 32,
    gender: "Female",
    diagnosis: "Hypertension",
    admissionDate: "2026-02-20",
  },
  {
    id: "P003",
    name: "Wang Jun",
    age: 58,
    gender: "Male",
    diagnosis: "Coronary Heart Disease",
    admissionDate: "2026-03-01",
  },
  {
    id: "P004",
    name: "Chen Mei",
    age: 27,
    gender: "Female",
    diagnosis: "Asthma",
    admissionDate: "2026-03-03",
  },
  {
    id: "P005",
    name: "Liu Tao",
    age: 63,
    gender: "Male",
    diagnosis: "Chronic Kidney Disease",
    admissionDate: "2026-03-05",
  },
]

function handlePatientClick(patient: Patient) {
  // TODO: Replace with router navigation to /dashboard/patients/[id]
  console.info(`Navigate to patient detail: ${patient.id} - ${patient.name}`)
}

export function PatientsList({ patients = mockPatients }: { patients?: readonly Patient[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Records</CardTitle>
        <CardDescription>
          Manage and view patient information. Click a row to view details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Diagnosis</TableHead>
              <TableHead>Admission Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No patients found.
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow
                  key={patient.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => handlePatientClick(patient)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      handlePatientClick(patient)
                    }
                  }}
                >
                  <TableCell className="font-medium">{patient.id}</TableCell>
                  <TableCell>{patient.name}</TableCell>
                  <TableCell>{patient.age}</TableCell>
                  <TableCell>{patient.gender}</TableCell>
                  <TableCell>{patient.diagnosis}</TableCell>
                  <TableCell>{patient.admissionDate}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
