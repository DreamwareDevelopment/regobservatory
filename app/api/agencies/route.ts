import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET() {
  try {
    const agencies = await prisma.agency.findMany({
      select: {
        id: true,
        displayName: true,
      },
      orderBy: {
        displayName: 'asc',
      },
    })

    return NextResponse.json(agencies)
  } catch (error) {
    console.error("Error fetching agencies:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
