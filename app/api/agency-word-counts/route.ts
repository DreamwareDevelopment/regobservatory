import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET() {
  try {
    const agencies = await prisma.agency.findMany({
      where: {
        parentId: null, // Fetch only top-level agencies
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        parentId: true,
        children: {
          select: {
            id: true,
            name: true,
            shortName: true,
            parentId: true,
            history: {
              select: {
                wordCount: true,
              },
              orderBy: {
                date: "desc",
              },
              take: 1,
            },
          },
        },
        history: {
          select: {
            wordCount: true,
          },
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
      },
    })

    const formattedAgencies = []

    for (const agency of agencies) {
      const formattedChildren = []
      let parentWordCount = agency.history[0]?.wordCount || 0
      for (const child of agency.children) {
        formattedChildren.push({
          ...child,
          wordCount: child.history[0]?.wordCount || 0,
        })
        parentWordCount += child.history[0]?.wordCount || 0
      }

      formattedAgencies.push({
        ...agency,
        wordCount: parentWordCount,
        children: formattedChildren,
      })
    }

    return NextResponse.json(formattedAgencies)
  } catch (error) {
    console.error("Error fetching agency data:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
