"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Agency = {
  id: string
  displayName: string
}

interface SearchResult {
  date: string;
  title: number;
  text: string;
  identifier: string;
}

const AgencySearch = () => {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null)
  const [query, setQuery] = useState<string>("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchAgencies = async () => {
      try {
        const response = await fetch("/api/agencies")
        const result = await response.json()
        setAgencies(result)
      } catch (error) {
        console.error("Error fetching agencies:", error)
      }
    }

    fetchAgencies()
  }, [])

  const handleSearch = async () => {
    setIsLoading(true)
    try {
      if (!query) {
        return;
      }
      const url = new URL("/api/search", window.location.origin)
      url.searchParams.append("query", query)
      if (selectedAgency) {
        url.searchParams.append("agencyId", selectedAgency)
      }
      const response = await fetch(url.toString())
      const results = await response.json() as SearchResult[]
      setResults(results)
    } catch (error) {
      console.error("Error fetching search results:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Search Regulations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search query"
            className="border p-2 rounded w-full"
          />
          <div className="flex gap-4 sm:flex-1">
            <Select
              value={selectedAgency || "all"}
              onValueChange={(value) => setSelectedAgency(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an agency" />
              </SelectTrigger>
              <SelectContent className="max-w-[85vw]">
                <SelectItem value="all">All Agencies ({agencies.length})</SelectItem>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button 
              onClick={handleSearch} 
              className="bg-primary text-white px-4 py-2 rounded whitespace-nowrap"
            >
              Search
            </button>
          </div>
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <ul className="pl-5">
            {results.map((result, index) => (
              <li key={index}>
                <div className="flex flex-col items-start gap-2 p-2 border-b shadow-sm">
                  <h3 className="text-md font-bold">§ {result.title}.{result.identifier}</h3>
                  <p className="text-sm text-muted-foreground">{result.date}</p>
                  <p className="text-md text-muted-foreground">{result.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default AgencySearch
