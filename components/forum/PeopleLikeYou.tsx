"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Bell,
  ChevronDownIcon,
  BarChart3,
} from "lucide-react";
import PeopleSuggestions from "./people-suggestions";

type TabType = "trending" | "pinned" | "latest";

interface ForumPost {
  id: number;
  author: string;
  avatar: string;
  title: string;
  preview: string;
  upvotes: number;
  comments: number;
  timestamp: string;
  daysAgo: number;
  monthsAgo: number;
}

export default function ForumsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("trending");

  const forumPosts: ForumPost[] = [
    {
      id: 1,
      author: "Christmas Cassandra",
      avatar: "/placeholder.svg?height=40&width=40",
      title: "What are some of the tool streamfi should have?",
      preview:
        "Lorem ipsum dolor sit amet consectetur. Viverra placerat arcu eiam ipsum. Fringilla quam elit commodo vel. Eget faucet ut rhoncus mauris...",
      upvotes: 0,
      comments: 105,
      timestamp: "2 May, 2024",
      daysAgo: 2,
      monthsAgo: 3,
    },
    {
      id: 2,
      author: "Christmas Cassandra",
      avatar: "/placeholder.svg?height=40&width=40",
      title: "What are some of the tool streamfi should have?",
      preview:
        "Lorem ipsum dolor sit amet consectetur. Viverra placerat arcu eiam ipsum. Fringilla quam elit commodo vel. Eget faucet ut rhoncus mauris...",
      upvotes: 0,
      comments: 105,
      timestamp: "2 May, 2024",
      daysAgo: 2,
      monthsAgo: 3,
    },
    {
      id: 3,
      author: "Christmas Cassandra",
      avatar: "/placeholder.svg?height=40&width=40",
      title: "What are some of the tool streamfi should have?",
      preview:
        "Lorem ipsum dolor sit amet consectetur. Viverra placerat arcu eiam ipsum. Fringilla quam elit commodo vel. Eget faucet ut rhoncus mauris...",
      upvotes: 0,
      comments: 105,
      timestamp: "2 May, 2024",
      daysAgo: 2,
      monthsAgo: 3,
    },
  ];

  const suggestions = [
    { name: "Christmas Cassandra", pub: "78%", tier: "T&R 7" },
    { name: "Christmas Cassandra", pub: "30%", tier: "T&R 4" },
    { name: "Christmas Cassandra", pub: "15%", tier: "T&R 1" },
  ];

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Top Navigation */}
      <nav className="border-b border-gray-800 px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">StreamFi</span>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center space-x-6">
              <button className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-800 text-white">
                <MessageSquare className="w-4 h-4" />
                <span>Forums</span>
              </button>
              <button className="text-gray-400 hover:text-white transition-colors">
                Leaderboard
              </button>
              <button className="text-gray-400 hover:text-white transition-colors">
                Weekly Highlights
              </button>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
            >
              <Bell className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src="/placeholder.svg?height=32&width=32" />
                <AvatarFallback className="bg-[#5D13A4]">U</AvatarFallback>
              </Avatar>
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Forums Section */}
          <div className="lg:col-span-2 ">
            <div className="flex rounded-lg items-center justify-between bg-[#17191A4D] p-5 mb-6">
              <h1 className="text-2xl font-bold">Forums</h1>
              <Button className="bg-[#5D13A4] hover:bg-[#5D13A4]/70 text-white">
                Add Discussion
              </Button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-6 mb-6 border-b border-gray-700">
              {(["trending", "pinned", "latest"] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 border-b-2 transition-all duration-200 ${
                    activeTab === tab
                      ? "border-blue-500 text-blue-400 font-medium"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <span className="capitalize">{tab}</span>
                </button>
              ))}
            </div>

            {/* Forum Posts */}
            <div className="space-y-4 mb-8">
              {forumPosts.map((post, index) => (
                <div
                  key={post.id}
                  className="bg-[#17191A4D] rounded-lg p-6 hover:bg-gray-750 transition-all duration-300 animate-slide-in"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <div className="flex items-start space-x-4">
                    <Avatar className="w-10 h-10">
                      <AvatarImage
                        src={post.avatar || "/placeholder.svg"}
                        alt={post.author}
                      />
                      <AvatarFallback className="bg-[#5D13A4]">
                        {post.author
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm text-gray-400">
                          @{post.author.replace(/\s+/g, "").toLowerCase()}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold mb-2 hover:text-blue-400 cursor-pointer transition-colors">
                        {post.title}
                      </h3>

                      <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                        {post.preview}
                      </p>

                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <span>
                          {post.timestamp} • {post.daysAgo} days ago •{" "}
                          {post.monthsAgo} months ago
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-green-400 p-1 transition-colors"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <span className="text-sm">Upvote</span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-red-400 p-1 transition-colors"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <span className="text-sm">Downvote</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 cursor-pointer transition-colors">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-sm">
                            {post.comments} Comments
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>1 - 15 of 750 active topics</span>
              <div className="flex items-center space-x-2">
                <span>Page</span>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((page) => (
                    <button
                      key={page}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                        page === 1
                          ? "bg-[#5D13A4] text-white"
                          : "hover:bg-gray-800"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <span className="px-2">...</span>
                  <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-800">
                    100
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Search Section */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Search for Categories
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search..."
                  className="bg-[#17191A4D]  border-gray-700 text-white pl-10 focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            {/* People Like You Section */}
            <div>
              <PeopleSuggestions />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-in {
          animation: slide-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
