"use client"

import NotFound from "@/components/error/NotFound"
import { useRouter } from "next/navigation"

export default function NotFoundPage() {
  const router = useRouter()

  return <NotFound onGoBack={() => router.back()} />
}
