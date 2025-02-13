import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const agencyId = searchParams.get('agencyId')

  try {
    let agencyHistory;

    if (agencyId) {
      agencyHistory = await prisma.agencyHistory.findMany({
        where: {
          agencyId: agencyId,
        },
        select: {
          id: true,
          agencyId: true,
          wordCount: true,
          date: true,
        },
        orderBy: {
          date: "asc",
        },
      })
    } else {
      // Fetch unfiltered results
      agencyHistory = await prisma.agencyHistory.findMany({
        select: {
          id: true,
          agencyId: true,
          wordCount: true,
          date: true,
        },
        orderBy: {
          date: "asc",
        },
      })
    }

    return NextResponse.json(agencyHistory)
  } catch (error) {
    console.error("Error fetching agency history:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
