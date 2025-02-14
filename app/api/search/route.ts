import { embedText } from "@/lib/ai";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AgencyEmbedding } from "@prisma/client";
import { retryWithBackoff } from "@/lib/utils";

// Was thinking about using the xml in the response, but it's too large to display in search results UI IMO
// async function fetchSectionContent(date: string, title: number, part: string, section: string) {
//   const params = new URLSearchParams({
//     part,
//     section,
//   });

//   const url = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${title}.xml?${params.toString()}`;
//   const response = await fetch(url);

//   if (response.status === 429) {
//     throw new Error('Rate limited');
//   }

//   if (!response.ok) {
//     throw new Error(`HTTP error! status: ${response.status}`);
//   }

//   return await response.text();
// }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const agencyId = searchParams.get("agencyId");

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const { embedding } = await retryWithBackoff(async () => embedText(query));
  const formattedEmbedding = `[${embedding.join(',')}]`;

  const results = await prisma.$queryRaw<AgencyEmbedding[]>`
    SELECT date, title, text, identifier FROM agency_embeddings
    WHERE (${agencyId}::text IS NULL OR agency_id = ${agencyId}::text)
    AND type = 'SECTION'
    ORDER BY embedding <=> ${formattedEmbedding}::vector
    LIMIT 10;
  `;

  return NextResponse.json(results);
}
