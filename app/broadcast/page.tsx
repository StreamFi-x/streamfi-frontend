"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BroadcastPlayer } from "@/components/streaming/BroadcastPlayer";
import VideoPlayer from "@/components/streaming/VideoPlayer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, AlertCircle } from "lucide-react";
import { getIngest } from "@livepeer/react/external";

export default function BroadcastPage() {
  const [streamKey, setStreamKey] = useState<string>("");
  const [playbackId, setPlaybackId] = useState<string>("");
  const [ingestUrl, setIngestUrl] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate default ingest URL (you can customize this based on your Livepeer setup)
  useEffect(() => {
    if (streamKey) {
      const ingestUrl = getIngest(streamKey);
      if (ingestUrl) {
        setIngestUrl(ingestUrl);
      }
    }
  }, [streamKey]);

  const handleStartStream = () => {
    if (!streamKey) {
      setError("Please enter a stream key");
      return;
    }
    setIsStreaming(true);
    setError(null);
  };

  const handleStopStream = () => {
    setIsStreaming(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Stream Broadcasting</h1>
        <p className="text-gray-600">
          Start your live stream and manage your broadcast settings
        </p>
      </div>

      <Tabs defaultValue="broadcast" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stream Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Stream Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="streamKey">Stream Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="streamKey"
                      value={streamKey}
                      onChange={e => setStreamKey(e.target.value)}
                      placeholder="Enter your stream key"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(streamKey)}
                      disabled={!streamKey}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ingestUrl">Ingest URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ingestUrl"
                      value={ingestUrl}
                      onChange={e => setIngestUrl(e.target.value)}
                      placeholder="RTMP ingest URL"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(ingestUrl)}
                      disabled={!ingestUrl}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleStartStream}
                    disabled={!streamKey || isStreaming}
                    className="flex-1"
                  >
                    {isStreaming ? "Streaming..." : "Start Stream"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleStopStream}
                    disabled={!isStreaming}
                  >
                    Stop Stream
                  </Button>
                </div>

                {isStreaming && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="animate-pulse">
                        LIVE
                      </Badge>
                      <span className="text-sm text-gray-600">
                        Your stream is now live
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Share your stream URL:{" "}
                      <code className="bg-gray-100 px-1 rounded">
                        {window.location.origin}/watch/{playbackId}
                      </code>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stream Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Stream Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {isStreaming && streamKey ? (
                  <div className="aspect-video">
                    <BroadcastPlayer
                      streamKey={streamKey}
                      ingestUrl={ingestUrl}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                        <ExternalLink className="w-8 h-8" />
                      </div>
                      <p>Start streaming to see preview</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stream Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="playbackId">Playback ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="playbackId"
                      value={playbackId}
                      onChange={e => setPlaybackId(e.target.value)}
                      placeholder="Enter playback ID to preview"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(playbackId)}
                      disabled={!playbackId}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {playbackId && (
                  <div className="aspect-video">
                    <VideoPlayer
                      playbackId={playbackId}
                      title="Stream Preview"
                      isLive={true}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
