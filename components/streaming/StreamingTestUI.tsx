"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Play, Square, Trash2, Users, Activity } from "lucide-react";
import VideoPlayer from "./VideoPlayer";

interface StreamData {
  streamId: string;
  playbackId: string;
  streamKey: string;
  ingestUrl: string;
  rtmpUrl: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  createdAt: string;
  isHealthy?: boolean;
  suspended?: boolean;
  lastTerminatedAt?: number;
  profiles?: Array<{
    name: string;
    fps: number;
    bitrate: number;
    width: number;
    height: number;
  }>;
}

interface StreamStatus {
  hasStream: boolean;
  isLive: boolean;
  stream?: StreamData;
  health?: {
    isActive: boolean;
    lastSeen?: string;
    ingestRate?: number;
    outgoingRate?: number;
    viewerCount?: number;
  };
}

interface LiveStream {
  streamId: string;
  playbackId: string;
  isLive: boolean;
  viewerCount: number;
  startedAt: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  creator: {
    username: string;
    wallet: string;
  };
  playback: {
    hlsUrl: string;
    rtmpUrl?: string;
    dashUrl?: string;
  };
}

export default function StreamingTestUI() {
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Stream creation form
  const [streamForm, setStreamForm] = useState({
    title: "",
    description: "",
    category: "",
    tags: "",
    record: true,
  });

  // Stream status
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({
    hasStream: false,
    isLive: false,
  });

  // Live streams
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);

  // Playback info
  const [playbackInfo, setPlaybackInfo] = useState<any>(null);

  // Test wallet authentication
  const testAuth = async () => {
    if (!walletAddress.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v2/streaming/auth/session", {
        headers: {
          "x-wallet-address": walletAddress,
        },
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Authentication successful!");
        setStreamStatus(data.streamInfo);
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch {
      setError("Failed to authenticate wallet");
    } finally {
      setIsLoading(false);
    }
  };

  // Create stream
  const createStream = async () => {
    if (!walletAddress.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    if (!streamForm.title.trim()) {
      setError("Please enter a stream title");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const tags = streamForm.tags
        .split(",")
        .map(tag => tag.trim())
        .filter(tag => tag);

      const response = await fetch("/api/v2/streaming/streams/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletAddress,
        },
        body: JSON.stringify({
          title: streamForm.title,
          description: streamForm.description,
          category: streamForm.category,
          tags: tags,
          record: streamForm.record,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Stream created successfully!");
        setStreamStatus({
          hasStream: true,
          isLive: false,
          stream: data.stream,
        });
      } else {
        setError(data.error || "Failed to create stream");
      }
    } catch {
      setError("Failed to create stream");
    } finally {
      setIsLoading(false);
    }
  };

  // Start stream
  const startStream = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v2/streaming/streams/start", {
        method: "POST",
        headers: {
          "x-wallet-address": walletAddress,
        },
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Stream started successfully!");
        setStreamStatus(prev => ({
          ...prev,
          isLive: true,
          stream: data.stream,
        }));
      } else {
        setError(data.error || "Failed to start stream");
      }
    } catch {
      setError("Failed to start stream");
    } finally {
      setIsLoading(false);
    }
  };

  // Stop stream
  const stopStream = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v2/streaming/streams/stop", {
        method: "POST",
        headers: {
          "x-wallet-address": walletAddress,
        },
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Stream stopped successfully!");
        setStreamStatus(prev => ({
          ...prev,
          isLive: false,
        }));
      } else {
        setError(data.error || "Failed to stop stream");
      }
    } catch {
      setError("Failed to stop stream");
    } finally {
      setIsLoading(false);
    }
  };

  // Terminate stream
  const terminateStream = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v2/streaming/streams/terminate", {
        method: "POST",
        headers: {
          "x-wallet-address": walletAddress,
        },
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Stream terminated successfully!");
        setStreamStatus(prev => ({
          ...prev,
          isLive: false,
        }));
      } else {
        setError(data.error || "Failed to terminate stream");
      }
    } catch {
      setError("Failed to terminate stream");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete stream
  const deleteStream = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v2/streaming/streams/delete", {
        method: "DELETE",
        headers: {
          "x-wallet-address": walletAddress,
        },
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Stream deleted successfully!");
        setStreamStatus({
          hasStream: false,
          isLive: false,
        });
      } else {
        setError(data.error || "Failed to delete stream");
      }
    } catch {
      setError("Failed to delete stream");
    } finally {
      setIsLoading(false);
    }
  };

  // Get stream status
  const getStreamStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v2/streaming/streams/status", {
        headers: {
          "x-wallet-address": walletAddress,
        },
      });

      const data = await response.json();

      if (data.success) {
        setStreamStatus({
          hasStream: data.hasStream,
          isLive: data.stream?.isLive || false,
          stream: data.stream,
          health: data.stream?.health,
        });
      } else {
        setError(data.error || "Failed to get stream status");
      }
    } catch {
      setError("Failed to get stream status");
    } finally {
      setIsLoading(false);
    }
  };

  // Get live streams
  const getLiveStreams = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v2/streaming/playback/live");
      const data = await response.json();

      if (data.success) {
        setLiveStreams(data.streams);
      } else {
        setError(data.error || "Failed to get live streams");
      }
    } catch {
      setError("Failed to get live streams");
    } finally {
      setIsLoading(false);
    }
  };

  // Get playback info
  const getPlaybackInfo = async () => {
    if (!walletAddress.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v2/streaming/playback/wallet/${walletAddress}`
      );
      const data = await response.json();

      if (data.success) {
        setPlaybackInfo(data.stream.playbackInfo);
        console.log(data.stream.playbackInfo.playbackInfo);
      } else {
        setError(data.error || "Failed to get playback info");
      }
    } catch {
      setError("Failed to get playback info");
    } finally {
      setIsLoading(false);
    }
  };

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          StreamFi V2 Streaming Test UI
        </h1>
        <p className="text-gray-600">
          Test the new wallet-based streaming backend with Livepeer integration
        </p>
      </div>

      {/* Wallet Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Wallet Authentication</CardTitle>
          <CardDescription>
            Enter your wallet address to authenticate and test streaming
            functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="0x1234567890abcdef"
              value={walletAddress}
              onChange={e => setWalletAddress(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={testAuth}
              disabled={isLoading || !walletAddress.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Test Auth"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="stream" className="space-y-6">
        <TabsList>
          <TabsTrigger value="stream">Stream Management</TabsTrigger>
          <TabsTrigger value="playback">Playback</TabsTrigger>
          <TabsTrigger value="player">Video Player</TabsTrigger>
          <TabsTrigger value="live">Live Streams</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        {/* Stream Management Tab */}
        <TabsContent value="stream" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Stream</CardTitle>
              <CardDescription>
                Create a new stream for your wallet address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Stream Title *</Label>
                <Input
                  id="title"
                  placeholder="My Awesome Stream"
                  value={streamForm.title}
                  onChange={e =>
                    setStreamForm(prev => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Stream description"
                  value={streamForm.description}
                  onChange={e =>
                    setStreamForm(prev => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="Gaming, Technology, etc."
                  value={streamForm.category}
                  onChange={e =>
                    setStreamForm(prev => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="gaming, live, fun"
                  value={streamForm.tags}
                  onChange={e =>
                    setStreamForm(prev => ({ ...prev, tags: e.target.value }))
                  }
                />
              </div>

              <Button
                onClick={createStream}
                disabled={
                  isLoading || !walletAddress.trim() || !streamForm.title.trim()
                }
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Create Stream"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Stream Controls */}
          {streamStatus.hasStream && (
            <Card>
              <CardHeader>
                <CardTitle>Stream Controls</CardTitle>
                <CardDescription>Manage your stream</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={startStream}
                    disabled={isLoading || streamStatus.isLive}
                    variant="default"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Stream
                  </Button>

                  <Button
                    onClick={stopStream}
                    disabled={isLoading || !streamStatus.isLive}
                    variant="destructive"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop Stream
                  </Button>

                  <Button
                    onClick={terminateStream}
                    disabled={isLoading || !streamStatus.isLive}
                    variant="secondary"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Terminate Stream
                  </Button>

                  <Button
                    onClick={deleteStream}
                    disabled={isLoading}
                    variant="outline"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Stream
                  </Button>
                </div>

                {streamStatus.stream && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Stream Information</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Title:</strong> {streamStatus.stream.title}
                      </div>
                      <div>
                        <strong>Stream ID:</strong>{" "}
                        {streamStatus.stream.streamId}
                      </div>
                      <div>
                        <strong>Playback ID:</strong>{" "}
                        {streamStatus.stream.playbackId}
                      </div>
                      <div>
                        <strong>Stream Key:</strong>{" "}
                        {streamStatus.stream.streamKey}
                      </div>
                      <div>
                        <strong>Ingest URL:</strong>{" "}
                        {streamStatus.stream.ingestUrl}
                      </div>
                      <div>
                        <strong>Status:</strong>
                        <Badge
                          variant={
                            streamStatus.isLive ? "default" : "secondary"
                          }
                          className="ml-2"
                        >
                          {streamStatus.isLive ? "Live" : "Offline"}
                        </Badge>
                      </div>
                      {streamStatus.stream.isHealthy !== undefined && (
                        <div>
                          <strong>Health:</strong>
                          <Badge
                            variant={
                              streamStatus.stream.isHealthy
                                ? "default"
                                : "destructive"
                            }
                            className="ml-2"
                          >
                            {streamStatus.stream.isHealthy
                              ? "Healthy"
                              : "Unhealthy"}
                          </Badge>
                        </div>
                      )}
                      {streamStatus.stream.suspended && (
                        <div>
                          <strong>Suspended:</strong>
                          <Badge variant="destructive" className="ml-2">
                            Yes
                          </Badge>
                        </div>
                      )}
                      {streamStatus.stream.lastTerminatedAt && (
                        <div>
                          <strong>Last Terminated:</strong>{" "}
                          {new Date(
                            streamStatus.stream.lastTerminatedAt
                          ).toLocaleString()}
                        </div>
                      )}
                      {streamStatus.stream.profiles &&
                        streamStatus.stream.profiles.length > 0 && (
                          <div>
                            <div>
                              <strong>Transcoding Profiles:</strong>
                            </div>
                            <ul className="ml-4 space-y-1">
                              {streamStatus.stream.profiles.map(
                                (profile: any, index: number) => (
                                  <li key={index} className="text-xs">
                                    {profile.name}: {profile.width}x
                                    {profile.height} @ {profile.bitrate}bps
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Playback Tab */}
        <TabsContent value="playback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Playback Information</CardTitle>
              <CardDescription>
                Get playback URLs for your stream
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={getPlaybackInfo}
                disabled={isLoading || !walletAddress.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Get Playback Info"
                )}
              </Button>

              {playbackInfo && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Playback Info</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Playback ID:</strong>
                      <code className="ml-2 bg-gray-200 px-2 py-1 rounded text-xs">
                        {playbackInfo.playbackId}
                      </code>
                    </div>
                    {playbackInfo.playbackInfo.meta.source[0].url && (
                      <div>
                        <strong>Hls URL:</strong>
                        <code className="ml-2 bg-gray-200 px-2 py-1 rounded text-xs">
                          {playbackInfo.playbackInfo.meta.source[0].url}
                        </code>
                      </div>
                    )}
                    {playbackInfo.playbackInfo.meta.source[1].url && (
                      <div>
                        <strong>Webrtc URL:</strong>
                        <code className="ml-2 bg-gray-200 px-2 py-1 rounded text-xs">
                          {playbackInfo.playbackInfo.meta.source[1].url}
                        </code>
                      </div>
                    )}
                    <div>
                      <strong>Status:</strong>
                      <Badge
                        variant={playbackInfo.isLive ? "default" : "secondary"}
                        className="ml-2"
                      >
                        {playbackInfo.isLive ? "Live" : "Offline"}
                      </Badge>
                    </div>
                    {playbackInfo.viewerCount !== undefined && (
                      <div>
                        <strong>Viewers:</strong> {playbackInfo.viewerCount}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video Player Tab */}
        <TabsContent value="player" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Video Player</CardTitle>
              <CardDescription>
                Test video playback with your stream
              </CardDescription>
            </CardHeader>
            <CardContent>
              {playbackInfo ? (
                <VideoPlayer
                  title={playbackInfo.title || "Live Stream"}
                  isLive={playbackInfo.isLive}
                  viewerCount={playbackInfo.viewerCount}
                  playbackId={playbackInfo.playbackId}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No live stream available</p>
                  <p className="text-sm">
                    Get playback info first to test video player
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Streams Tab */}
        <TabsContent value="live" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Streams</CardTitle>
              <CardDescription>View all currently live streams</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={getLiveStreams} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Refresh Live Streams"
                )}
              </Button>

              {liveStreams.length > 0 && (
                <div className="mt-4 space-y-4">
                  {liveStreams.map((stream, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{stream.title}</h3>
                            <p className="text-sm text-gray-600">
                              {stream.creator.username}
                            </p>
                            {stream.description && (
                              <p className="text-sm text-gray-500 mt-1">
                                {stream.description}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2">
                              {stream.tags?.map((tag, tagIndex) => (
                                <Badge key={tagIndex} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              <span>{stream.viewerCount}</span>
                            </div>
                            <Badge variant="destructive" className="mt-1">
                              Live
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {liveStreams.length === 0 && !isLoading && (
                <div className="mt-4 text-center text-gray-500">
                  No live streams found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stream Status</CardTitle>
              <CardDescription>
                Check the current status of your stream
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={getStreamStatus}
                disabled={isLoading || !walletAddress.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Check Status"
                )}
              </Button>

              {streamStatus.hasStream && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Current Stream Status</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Has Stream:</strong>
                      <Badge variant="default" className="ml-2">
                        Yes
                      </Badge>
                    </div>
                    <div>
                      <strong>Is Live:</strong>
                      <Badge
                        variant={streamStatus.isLive ? "default" : "secondary"}
                        className="ml-2"
                      >
                        {streamStatus.isLive ? "Yes" : "No"}
                      </Badge>
                    </div>
                    {streamStatus.stream && (
                      <>
                        <div>
                          <strong>Title:</strong> {streamStatus.stream.title}
                        </div>
                        <div>
                          <strong>Stream ID:</strong>{" "}
                          {streamStatus.stream.streamId}
                        </div>
                        <div>
                          <strong>Playback ID:</strong>{" "}
                          {streamStatus.stream.playbackId}
                        </div>
                      </>
                    )}
                    {streamStatus.health && (
                      <div className="mt-2">
                        <h4 className="font-medium">Health Information</h4>
                        <div className="space-y-1">
                          <div>
                            <strong>Active:</strong>{" "}
                            {streamStatus.health.isActive ? "Yes" : "No"}
                          </div>
                          {streamStatus.health.lastSeen && (
                            <div>
                              <strong>Last Seen:</strong>{" "}
                              {streamStatus.health.lastSeen}
                            </div>
                          )}
                          {streamStatus.health.ingestRate && (
                            <div>
                              <strong>Ingest Rate:</strong>{" "}
                              {streamStatus.health.ingestRate} kbps
                            </div>
                          )}
                          {streamStatus.health.outgoingRate && (
                            <div>
                              <strong>Outgoing Rate:</strong>{" "}
                              {streamStatus.health.outgoingRate} kbps
                            </div>
                          )}
                          {streamStatus.health.viewerCount !== undefined && (
                            <div>
                              <strong>Viewers:</strong>{" "}
                              {streamStatus.health.viewerCount}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!streamStatus.hasStream && !isLoading && (
                <div className="mt-4 text-center text-gray-500">
                  No stream found for this wallet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Clear Messages Button */}
      <div className="mt-6 flex justify-center">
        <Button onClick={clearMessages} variant="outline">
          Clear Messages
        </Button>
      </div>
    </div>
  );
}
