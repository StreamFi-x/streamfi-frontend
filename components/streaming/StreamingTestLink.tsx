"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Play, TestTube } from "lucide-react";

export default function StreamingTestLink() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          Streaming V2 Test
        </CardTitle>
        <CardDescription>
          Test the new wallet-based streaming backend with Livepeer integration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This test interface allows you to:
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Test wallet authentication</li>
            <li>• Create and manage streams</li>
            <li>• Test video playback</li>
            <li>• View live streams</li>
            <li>• Monitor stream health</li>
          </ul>
          <Link href="/streaming-test">
            <Button className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Open Test Interface
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
