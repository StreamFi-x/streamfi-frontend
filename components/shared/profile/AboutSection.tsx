"use client"

import { useState } from "react"
import { Twitter, Instagram, DiscIcon as Discord, Edit3 } from "lucide-react"
import Button from "@/components/ui/Button"
import StreamInfoModal from "@/components/dashboard/common/StreamInfoModal"

interface AboutSectionProps {
  username: string
  followers: number
  bio?: string
  socialLinks?: {
    twitter?: string
    instagram?: string
    discord?: string
  }
  isOwner: boolean
}

const AboutSection = ({ username, followers, bio, socialLinks, isOwner }: AboutSectionProps) => {
  const [showBioModal, setShowBioModal] = useState(false)
  const [userBio, setUserBio] = useState(bio || "")

  const handleSaveBio = (data: any) => {
    setUserBio(data.description || "")
    setShowBioModal(false)
  }

  return (
    <div className="bg-[#1A1A1A] rounded-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-lg font-medium">About {username}</h2>
        <div className="flex items-center">
          <span className="text-sm text-gray-400 mr-4">{followers.toLocaleString()} followers</span>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="bg-[#2D2F31] hover:bg-[#3D3F41] text-white border-none"
              onClick={() => setShowBioModal(true)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Bio
            </Button>
          )}
        </div>
      </div>

      {socialLinks && (
        <div className="flex space-x-4 mb-4">
          {socialLinks.twitter && (
            <a
              href={socialLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white"
            >
              <Twitter className="h-5 w-5" />
            </a>
          )}
          {socialLinks.instagram && (
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white"
            >
              <Instagram className="h-5 w-5" />
            </a>
          )}
          {socialLinks.discord && (
            <a
              href={socialLinks.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white"
            >
              <Discord className="h-5 w-5" />
            </a>
          )}
        </div>
      )}

      {userBio ? (
        <p className="text-gray-300 text-sm whitespace-pre-line">{userBio}</p>
      ) : (
        <div className="text-gray-400 text-sm">
          {isOwner ? (
            <div className="bg-[#2D2F31] p-4 rounded-md">
              <p className="mb-2">You haven&apos;t added a bio yet.</p>
              <p>Tell viewers about yourself, your content, and your streaming schedule.</p>
              <Button
                variant="outline"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white border-none mt-3"
                onClick={() => setShowBioModal(true)}
              >
                Add Bio
              </Button>
            </div>
          ) : (
            <p>{username} hasn&apos;t added a bio yet.</p>
          )}
        </div>
      )}

      {showBioModal && (
        <StreamInfoModal
          initialData={{
            title: "",
            description: userBio,
            category: "",
            tags: [],
          }}
          onClose={() => setShowBioModal(false)}
          onSave={handleSaveBio}
        />
      )}
    </div>
  )
}

export default AboutSection
