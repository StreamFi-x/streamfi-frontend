"use client"

import PageNotFoundContent from "@/components/error/NotFound"
import { useRouter } from "next/navigation"

export default function NotFoundPage() {
  const router = useRouter()
  
  return <PageNotFoundContent onGoBack={() => router.back()} />
}