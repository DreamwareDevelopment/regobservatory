"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface Agency {
  id: string
  name: string
  shortName: string
  parentId: string | null
  wordCount: number
  children: Agency[]
}

interface TooltipData {
  x: number
  y: number
  name: string
  wordCount: number
  show: boolean
}

const BubbleChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<Agency[]>([])
  const [tooltip, setTooltip] = useState<TooltipData>({
    x: 0,
    y: 0,
    name: "",
    wordCount: 0,
    show: false,
  })
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const nodesRef = useRef<d3.HierarchyCircularNode<Agency>[]>([])
  const drawRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch("/api/agency-word-counts")
      const rawData: Agency[] = await response.json()
      setData(rawData)
    }

    fetchData()
  }, [])

  const findHoveredNode = (mouseX: number, mouseY: number) => {
    const transform = transformRef.current
    // Convert mouse coordinates back to untransformed space
    const x = (mouseX - transform.x) / transform.k
    const y = (mouseY - transform.y) / transform.k

    // Check in reverse order to detect smaller bubbles that might be on top
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const node = nodesRef.current[i]
      const dx = x - node.x
      const dy = y - node.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance <= node.r) {
        return node
      }
    }
    return null
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num)
  }

  useEffect(() => {
    if (!data.length || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const color = d3.scaleOrdinal(d3.schemeCategory10)

    const draw = () => {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      nodesRef.current.forEach((node) => {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r, 0, 2 * Math.PI)
        ctx.fillStyle = color(node.data.parentId || node.data.id)
        ctx.globalAlpha = node.depth === 0 ? 0.7 : 0.5
        ctx.fill()
        ctx.strokeStyle = "#457b9d"
        ctx.stroke()

        if (node.r > 10) {
          ctx.fillStyle = "#ffffff"
          ctx.font = `${Math.min(node.r / 3, 14)}px Arial`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(node.data.shortName || "", node.x, node.y)
        }
      })
    }
    
    drawRef.current = draw

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (!container) return
      const width = Math.min(container.clientWidth, 800)
      const height = Math.min(width * 0.75, 600)
      canvas.width = width
      canvas.height = height
      
      const pack = d3.pack<Agency>().size([width, height]).padding(3)
      const root = d3.hierarchy<Agency>({ children: data } as Agency).sum((d) => d.wordCount)
      nodesRef.current = pack(root).descendants().slice(1)
      
      if (drawRef.current) drawRef.current()
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top

      const hoveredNode = findHoveredNode(mouseX, mouseY)

      if (hoveredNode) {
        setTooltip({
          x: mouseX - 50,
          y: mouseY - 50,
          name: hoveredNode.data.name,
          wordCount: hoveredNode.data.wordCount,
          show: true,
        })
      } else {
        setTooltip((prev) => ({ ...prev, show: false }))
      }
    }

    const handleMouseLeave = () => {
      setTooltip((prev) => ({ ...prev, show: false }))
    }

    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseleave", handleMouseLeave)

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        transformRef.current = event.transform
        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.translate(event.transform.x, event.transform.y)
        ctx.scale(event.transform.k, event.transform.k)
        if (drawRef.current) drawRef.current()
        ctx.restore()
      })

    d3.select(canvas).call(zoom)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseleave", handleMouseLeave)
      d3.select(canvas).on(".zoom", null)
      drawRef.current = null
    }
  }, [data])

  return (
    <div className="w-full max-w-3xl flex flex-col items-center relative bg-secondary p-4 rounded-lg">
      <canvas 
        ref={canvasRef} 
        className="w-full max-w-full touch-none" 
        style={{ aspectRatio: '4/3' }}
      />
      {tooltip.show && (
        <div
          className="absolute z-10 bg-background px-4 py-2 rounded-lg shadow-lg border border-border"
          style={{
            left: Math.max(0, Math.min(tooltip.x, window.innerWidth - 200)),
            top: Math.max(0, Math.min(tooltip.y, window.innerHeight - 100)),
            transform: "translate(0, -100%)",
            pointerEvents: "none",
          }}
        >
          <div className="font-semibold">{tooltip.name}</div>
          <div className="text-sm text-gray-600">Word Count: {formatNumber(tooltip.wordCount)}</div>
        </div>
      )}
    </div>
  )
}

export default BubbleChart
