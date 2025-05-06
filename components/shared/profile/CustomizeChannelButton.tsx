import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Settings, ExternalLink } from "lucide-react"

const CustomizeChannelButton = () => {
  return (
    <div className="flex items-center space-x-2">
      <Link href="/settings/profile">
        <Button variant="outline" className="bg-gray-800 hover:bg-gray-700 text-white border-none flex items-center">
          <Settings className="h-4 w-4 mr-2" />
          Customize Channel
        </Button>
      </Link>
      <Button  className="bg-transparent hover:bg-gray-700 text-white border-gray-600">
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default CustomizeChannelButton
