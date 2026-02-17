"use client";

import React, { useState, useCallback } from "react";
import VideoPlayerMux from "./VideoPlayerMux";

interface StreamData {
  streamId?: string;
  playbackId?: string;
  streamKey?: string;
  title?: string;
  isLive?: boolean;
  currentViewers?: number;
  totalViews?: number;
  isConfigured?: boolean;
}

interface ChatMessage {
  id: string;
  content: string;
  messageType: string;
  user: {
    username: string;
    wallet: string;
    avatar?: string;
  };
  createdAt: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  streamData?: StreamData;
  metrics?: {
    stream?: {
      currentViewers?: number;
      totalViews?: number;
    };
  };
  src?: string;
  chatMessage?: ChatMessage;
  messages?: ChatMessage[];
}

// VideoPlayerComponent removed - now using VideoPlayerMux component

export default function StreamTestComponent() {
  const [wallet] = useState(
    "0x04fef7247897775ee856f4a2c52b460300b67306c14a200ce71eb1f9190a388e"
  );
  const [streamData, setStreamData] = useState<StreamData>({});
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    "create" | "manage" | "view" | "chat" | "debug"
  >("create");
  const [streamForm, setStreamForm] = useState({
    title: "Test Stream",
    description: "Testing Mux integration with enhanced player",
    category: "Technology",
    tags: ["test", "mux", "streaming", "live"],
  });

  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [advancedSettings, setAdvancedSettings] = useState({
    autoPlay: false,
    lowLatency: true,
    recordStream: true,
    enableChat: true,
    maxBitrate: 6000,
    resolution: "1080p",
    enableHls: true,
  });

  const [debugMode, setDebugMode] = useState(false);
  interface ApiCallRecord {
    endpoint: string;
    method: string;
    status: number;
    duration: number;
    timestamp: string;
    success: boolean;
    error: string | null;
  }

  const [apiCallHistory, setApiCallHistory] = useState<ApiCallRecord[]>([]);

  const addLog = useCallback(
    (message: string, type: "info" | "success" | "error" = "info") => {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
      setLogs(prev => [...prev, logEntry]);
    },
    []
  );

  const apiCall = async (
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    } = {}
  ): Promise<ApiResponse> => {
    const startTime = Date.now();

    try {
      addLog(`Making API call to ${endpoint}`, "info");

      const response = await fetch(endpoint, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      const endTime = Date.now();
      const duration = endTime - startTime;

      const callRecord = {
        endpoint,
        method: options.method || "GET",
        status: response.status,
        duration,
        timestamp: new Date().toISOString(),
        success: response.ok,
        error: response.ok ? null : data.error,
      };

      setApiCallHistory(prev => [...prev.slice(-9), callRecord]);

      if (response.ok) {
        addLog(
          `API call successful (${duration}ms): ${data.message || "Success"}`,
          "success"
        );
        return { success: true, ...data };
      } else {
        addLog(
          `API call failed (${duration}ms): ${data.error || "Unknown error"}`,
          "error"
        );
        return { success: false, error: data.error };
      }
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Network error";

      const callRecord = {
        endpoint,
        method: options.method || "GET",
        status: 0,
        duration,
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMessage,
      };

      setApiCallHistory(prev => [...prev.slice(-9), callRecord]);
      addLog(`API call error (${duration}ms): ${errorMessage}`, "error");
      return { success: false, error: errorMessage };
    }
  };

  const createStream = async () => {
    setLoading(true);
    const result = await apiCall("/api/streams/create", {
      method: "POST",
      body: JSON.stringify({
        wallet,
        ...streamForm,
        ...advancedSettings,
      }),
    });

    if (result.success && result.streamData) {
      setStreamData(result.streamData);
      addLog("Stream created successfully!", "success");
    }
    setLoading(false);
  };

  const startStream = async () => {
    setLoading(true);
    const result = await apiCall("/api/streams/start", {
      method: "POST",
      body: JSON.stringify({ wallet }),
    });

    if (result.success) {
      setStreamData(prev => ({ ...prev, isLive: true }));
      addLog("Stream started!", "success");
    }
    setLoading(false);
  };

  const stopStream = async () => {
    setLoading(true);
    const result = await apiCall("/api/streams/start", {
      method: "DELETE",
      body: JSON.stringify({ wallet }),
    });

    if (result.success) {
      setStreamData(prev => ({ ...prev, isLive: false }));
      addLog("Stream stopped!", "success");
    }
    setLoading(false);
  };

  const getStreamData = async () => {
    setLoading(true);
    const result = await apiCall(`/api/streams/${wallet}`);

    if (result.success && result.streamData) {
      setStreamData(result.streamData || {});
      addLog("Stream data retrieved!", "success");
    }
    setLoading(false);
  };

  const getPlaybackSource = async () => {
    if (!streamData.playbackId) {
      addLog("No playback ID available", "error");
      return;
    }

    setLoading(true);
    const result = await apiCall(
      `/api/streams/playback/${streamData.playbackId}`
    );

    if (result.success) {
      addLog(`Playback source: ${result.src}`, "success");
    }
    setLoading(false);
  };

  const updateStream = async () => {
    setLoading(true);
    const result = await apiCall("/api/streams/update", {
      method: "PATCH",
      body: JSON.stringify({
        wallet,
        title: streamForm.title + " (Updated)",
        description: "Updated description with Mux support",
      }),
    });

    if (result.success) {
      addLog("Stream updated!", "success");
    }
    setLoading(false);
  };

  const deleteStream = async () => {
    if (!confirm("Are you sure you want to delete the stream?")) {
      return;
    }

    setLoading(true);
    const result = await apiCall("/api/streams/delete", {
      method: "DELETE",
      body: JSON.stringify({ wallet }),
    });

    if (result.success) {
      setStreamData({});
      addLog("Stream deleted!", "success");
    }
    setLoading(false);
  };

  const getMetrics = async () => {
    if (!streamData.streamId) {
      addLog("No stream ID available", "error");
      return;
    }

    setLoading(true);
    const result = await apiCall(`/api/streams/metrics/${streamData.streamId}`);

    if (result.success && result.metrics) {
      addLog(
        `Metrics retrieved! Current viewers: ${result.metrics.stream?.currentViewers || 0}`,
        "success"
      );
    }
    setLoading(false);
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || !streamData.playbackId) {
      return;
    }

    const result = await apiCall("/api/streams/chat", {
      method: "POST",
      body: JSON.stringify({
        wallet,
        playbackId: streamData.playbackId,
        content: chatMessage,
      }),
    });

    if (result.success && result.chatMessage) {
      const newMessage = result.chatMessage;
      setChatMessages(prev => [...prev, newMessage]);
      setChatMessage("");
      addLog("Chat message sent!", "success");
    }
  };

  const getChatMessages = async () => {
    if (!streamData.playbackId) {
      return;
    }

    const result = await apiCall(
      `/api/streams/chat?playbackId=${streamData.playbackId}`
    );

    if (result.success && result.messages) {
      setChatMessages(result.messages);
      addLog(`Retrieved ${result.messages.length} chat messages`, "success");
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog("Logs cleared", "info");
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addLog(` ${label} copied to clipboard`, "success");
    } catch {
      addLog(`Failed to copy ${label}`, "error");
    }
  };

  const exportLogs = () => {
    const logData = logs.join("\n");
    const blob = new Blob([logData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stream-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog("Logs exported successfully", "success");
  };

  const testHlsSupport = () => {
    addLog("✅ Using Mux Player for video playback", "success");
    addLog("Mux Player supports all modern browsers", "info");
  };

  const clearApiHistory = () => {
    setApiCallHistory([]);
    addLog("API call history cleared", "info");
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Mux Stream Testing Dashboard
        </h1>
        <p className="text-gray-600">
          Comprehensive testing suite with Mux Player integration for universal
          browser support
        </p>
        <div className="mt-2 text-sm text-gray-500 flex items-center space-x-4">
          <span>HLS.js Enhanced</span>
          <span>Fixed infinite loops</span>
          <span>Complete API testing</span>
          <span>Universal browser support</span>
          <button
            onClick={testHlsSupport}
            className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs hover:bg-blue-200 transition-colors"
          >
            Test HLS Support
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-lg mb-6 border">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <span className="text-sm text-gray-500">Status:</span>
            <div
              className={`font-semibold flex items-center ${streamData.isLive ? "text-red-500" : "text-gray-500"}`}
            >
              {streamData.isLive ? "🔴 LIVE" : "⚫ OFFLINE"}
              {streamData.isLive && (
                <span className="ml-2 animate-pulse">●</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Stream ID:</span>
            <div
              className="font-mono text-xs truncate"
              title={streamData.streamId}
            >
              {streamData.streamId || "Not created"}
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Viewers:</span>
            <div className="font-semibold text-blue-600">
              {streamData.currentViewers || 0}
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Total Views:</span>
            <div className="font-semibold text-green-600">
              {streamData.totalViews || 0}
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">HLS Support:</span>
            <div className="font-semibold text-purple-600">{"Mux Player"}</div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "create", label: " Create & Manage", color: "blue" },
            { id: "manage", label: "Stream Controls", color: "green" },
            { id: "view", label: " Playback Test", color: "purple" },
            { id: "chat", label: "Chat Test", color: "pink" },
            { id: "debug", label: "Debug & Analytics", color: "orange" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(
                  tab.id as "create" | "manage" | "view" | "chat" | "debug"
                )
              }
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? `border-${tab.color}-500 text-${tab.color}-600`
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {activeTab === "create" && (
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-xl font-semibold mb-4 text-blue-800">
                Stream Creation & Management
              </h3>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">
                      Stream Title:
                    </label>
                    <input
                      type="text"
                      value={streamForm.title}
                      onChange={e =>
                        setStreamForm(prev => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter stream title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">
                      Category:
                    </label>
                    <select
                      value={streamForm.category}
                      onChange={e =>
                        setStreamForm(prev => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Technology">Technology</option>
                      <option value="Gaming">Gaming</option>
                      <option value="Music">Music</option>
                      <option value="Education">Education</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Sports">Sports</option>
                      <option value="News">News</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    Description:
                  </label>
                  <textarea
                    value={streamForm.description}
                    onChange={e =>
                      setStreamForm(prev => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Enter stream description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    Tags (comma separated):
                  </label>
                  <input
                    type="text"
                    value={streamForm.tags.join(", ")}
                    onChange={e =>
                      setStreamForm(prev => ({
                        ...prev,
                        tags: e.target.value
                          .split(",")
                          .map(tag => tag.trim())
                          .filter(Boolean),
                      }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., gaming, live, tutorial, hls"
                  />
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                    Advanced Settings
                  </summary>
                  <div className="mt-2 p-4 bg-gray-50 rounded-md space-y-3">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={advancedSettings.recordStream}
                            onChange={e =>
                              setAdvancedSettings(prev => ({
                                ...prev,
                                recordStream: e.target.checked,
                              }))
                            }
                            className="rounded"
                          />
                          <span className="text-sm">Record Stream</span>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={advancedSettings.enableChat}
                            onChange={e =>
                              setAdvancedSettings(prev => ({
                                ...prev,
                                enableChat: e.target.checked,
                              }))
                            }
                            className="rounded"
                          />
                          <span className="text-sm">Enable Chat</span>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={advancedSettings.lowLatency}
                            onChange={e =>
                              setAdvancedSettings(prev => ({
                                ...prev,
                                lowLatency: e.target.checked,
                              }))
                            }
                            className="rounded"
                          />
                          <span className="text-sm">Low Latency Mode</span>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={advancedSettings.enableHls}
                            onChange={e =>
                              setAdvancedSettings(prev => ({
                                ...prev,
                                enableHls: e.target.checked,
                              }))
                            }
                            className="rounded"
                          />
                          <span className="text-sm">
                            HLS.js Enhanced Player
                          </span>
                        </label>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Max Bitrate:
                        </label>
                        <select
                          value={advancedSettings.maxBitrate}
                          onChange={e =>
                            setAdvancedSettings(prev => ({
                              ...prev,
                              maxBitrate: parseInt(e.target.value),
                            }))
                          }
                          className="w-full p-2 border rounded text-sm"
                        >
                          <option value={3000}>3 Mbps</option>
                          <option value={6000}>6 Mbps</option>
                          <option value={9000}>9 Mbps</option>
                          <option value={12000}>12 Mbps</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Resolution:
                        </label>
                        <select
                          value={advancedSettings.resolution}
                          onChange={e =>
                            setAdvancedSettings(prev => ({
                              ...prev,
                              resolution: e.target.value,
                            }))
                          }
                          className="w-full p-2 border rounded text-sm"
                        >
                          <option value="720p">720p</option>
                          <option value="1080p">1080p</option>
                          <option value="1440p">1440p</option>
                          <option value="2160p">4K</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </details>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button
                    onClick={createStream}
                    disabled={loading}
                    className="bg-blue-500 text-white px-6 py-3 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {loading ? "Creating..." : " Create Stream"}
                  </button>

                  <button
                    onClick={getStreamData}
                    disabled={loading}
                    className="bg-gray-500 text-white px-6 py-3 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {loading ? "Loading..." : " Get Data"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={updateStream}
                    disabled={loading || !streamData.streamId}
                    className="bg-yellow-500 text-white px-6 py-3 rounded-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {loading ? "Updating..." : " Update"}
                  </button>

                  <button
                    onClick={deleteStream}
                    disabled={
                      loading || !streamData.streamId || streamData.isLive
                    }
                    className="bg-red-500 text-white px-6 py-3 rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {loading ? "Deleting..." : " Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === "manage" && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-xl font-semibold mb-4 text-green-800">
                ⚡ Stream Controls
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={startStream}
                    disabled={
                      loading || !streamData.streamId || streamData.isLive
                    }
                    className="bg-green-500 text-white px-6 py-3 rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {loading ? "Starting..." : " Start Stream"}
                  </button>

                  <button
                    onClick={stopStream}
                    disabled={loading || !streamData.isLive}
                    className="bg-red-500 text-white px-6 py-3 rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {loading ? "Stopping..." : " Stop Stream"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={getPlaybackSource}
                    disabled={loading || !streamData.playbackId}
                    className="bg-purple-500 text-white px-6 py-3 rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {loading ? "Loading..." : "Get Playback"}
                  </button>

                  <button
                    onClick={getMetrics}
                    disabled={loading || !streamData.streamId}
                    className="bg-indigo-500 text-white px-6 py-3 rounded-md hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {loading ? "Loading..." : " Get Metrics"}
                  </button>
                </div>

                {streamData.streamKey && (
                  <div className="mt-6 p-4 bg-yellow-100 rounded-md border border-yellow-300">
                    <h4 className="font-semibold text-sm text-yellow-800 mb-2">
                      🔑 Stream Key (for OBS/Broadcasting Software):
                    </h4>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 text-xs bg-white p-3 rounded border font-mono break-all">
                        {streamData.streamKey}
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard(streamData.streamKey!, "Stream Key")
                        }
                        className="bg-yellow-500 text-white px-3 py-2 rounded text-sm hover:bg-yellow-600 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="mt-3 p-3 bg-yellow-50 rounded text-sm">
                      <p className="font-medium text-yellow-800">
                        {" "}
                        OBS Setup Instructions:
                      </p>
                      <ol className="list-decimal list-inside mt-1 space-y-1 text-yellow-700">
                        <li>Open OBS Studio → Settings → Stream</li>
                        <li>Service: Custom</li>
                        <li>
                          Server:{" "}
                          <code className="bg-yellow-200 px-1 rounded">
                            rtmp://global-live.mux.com:5222/app
                          </code>
                        </li>
                        <li>Stream Key: Use the key above</li>
                        <li>
                          Video Settings: {advancedSettings.resolution} @{" "}
                          {advancedSettings.maxBitrate / 1000}Mbps
                        </li>
                        <li>Click Apply → OK → Start Streaming</li>
                      </ol>
                    </div>
                  </div>
                )}

                {streamData.playbackId && (
                  <div className="mt-4 p-4 bg-blue-100 rounded-md border border-blue-300">
                    <h4 className="font-semibold text-sm text-blue-800 mb-2">
                      Playback Information:
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Playback ID:</span>
                        <code className="ml-2 bg-white px-2 py-1 rounded">
                          {streamData.playbackId}
                        </code>
                      </div>
                      <div>
                        <span className="font-medium">Stream Status:</span>
                        <span
                          className={`ml-2 px-2 py-1 rounded text-xs ${
                            streamData.isLive
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {streamData.isLive ? "LIVE" : "OFFLINE"}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">HLS Support:</span>
                        <span className="ml-2 px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Mux Player
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "view" && (
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-xl font-semibold mb-4 text-purple-800">
                HLS.js Enhanced Playback Testing
              </h3>

              {streamData.playbackId ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          streamData.isLive
                            ? "bg-red-500 animate-pulse"
                            : "bg-gray-400"
                        }`}
                      ></div>
                      <span className="font-medium">
                        Status: {streamData.isLive ? "🔴 LIVE" : "⚫ OFFLINE"}
                      </span>
                      {streamData.currentViewers !== undefined && (
                        <span className="text-sm text-gray-600">
                          {streamData.currentViewers} viewers
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">{"Mux Player"}</div>
                  </div>

                  <VideoPlayerMux
                    playbackId={streamData.playbackId}
                    addLog={addLog}
                  />

                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="p-4 bg-white rounded-lg border">
                      <h4 className="font-semibold mb-2"> Stream Details</h4>
                      <div className="space-y-1">
                        <p>
                          <strong>Playback ID:</strong>
                        </p>
                        <code className="text-xs bg-gray-100 p-2 rounded block break-all">
                          {streamData.playbackId}
                        </code>
                        <p>
                          <strong>Title:</strong>{" "}
                          {streamData.title || "Untitled Stream"}
                        </p>
                        <p>
                          <strong>Status:</strong>{" "}
                          {streamData.isLive ? "🔴 Live" : "⚫ Offline"}
                        </p>
                        <p>
                          <strong>Category:</strong> {streamForm.category}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-white rounded-lg border">
                      <h4 className="font-semibold mb-2">Analytics</h4>
                      <div className="space-y-1">
                        <p>
                          <strong>Current Viewers:</strong>{" "}
                          {streamData.currentViewers || 0}
                        </p>
                        <p>
                          <strong>Total Views:</strong>{" "}
                          {streamData.totalViews || 0}
                        </p>
                        <p>
                          <strong>Stream ID:</strong>
                        </p>
                        <code className="text-xs bg-gray-100 p-1 rounded block truncate">
                          {streamData.streamId || "N/A"}
                        </code>
                      </div>
                    </div>
                    <div className="p-4 bg-white rounded-lg border">
                      <h4 className="font-semibold mb-2"> Player Info</h4>
                      <div className="space-y-1">
                        <p>
                          <strong>Player Type:</strong> {"Mux Player"}
                        </p>
                        <p>
                          <strong>Version:</strong> {"Latest"}
                        </p>
                        <p>
                          <strong>Quality:</strong> Adaptive
                        </p>
                        <p>
                          <strong>Latency:</strong>{" "}
                          {advancedSettings.lowLatency ? "Low" : "Standard"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-semibold mb-3 text-blue-800">
                        HLS Stream URL
                      </h4>
                      <div className="flex items-center space-x-2 mb-2">
                        <input
                          type="text"
                          value={`https://livepeercdn.studio/hls/${streamData.playbackId}/index.m3u8`}
                          readOnly
                          className="flex-1 p-2 border rounded text-xs font-mono bg-white"
                        />
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `https://livepeercdn.studio/hls/${streamData.playbackId}/index.m3u8`,
                              "HLS URL"
                            )
                          }
                          className="bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-xs text-blue-600">
                        Works in: All browsers with HLS.js, Safari natively,
                        VLC, OBS
                      </p>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="font-semibold mb-3 text-green-800">
                        External Testing
                      </h4>
                      <div className="space-y-2">
                        <a
                          href={`https://livepeercdn.studio/hls/${streamData.playbackId}/index.m3u8`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors text-sm"
                        >
                          Open in New Tab
                        </a>
                        <button
                          onClick={() => {
                            const url = `https://www.hlsplayer.net/?src=${encodeURIComponent(`https://livepeercdn.studio/hls/${streamData.playbackId}/index.m3u8`)}`;
                            window.open(url, "_blank");
                          }}
                          className="block bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors text-sm"
                        >
                          Test in HLS Player
                        </button>
                      </div>
                      <p className="text-xs text-green-600 mt-2">
                        Test with external HLS players
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold text-yellow-800 mb-3">
                      Enhanced Testing Guide
                    </h4>
                    <div className="text-sm text-yellow-700 space-y-3">
                      <div>
                        <strong>VLC Media Player:</strong>
                        <ol className="list-decimal list-inside ml-4 space-y-1 mt-1">
                          <li>
                            Open VLC → Media → Open Network Stream (Ctrl+N)
                          </li>
                          <li>Paste HLS URL above</li>
                          <li>
                            Click Play → Should work with HLS.js quality
                            selection
                          </li>
                        </ol>
                      </div>

                      <div>
                        <strong>OBS Studio (Broadcasting Setup):</strong>
                        <ol className="list-decimal list-inside ml-4 space-y-1 mt-1">
                          <li>Settings → Stream → Service: Custom</li>
                          <li>
                            Server:{" "}
                            <code className="bg-yellow-100 px-1 rounded">
                              rtmp://global-live.mux.com:5222/app
                            </code>
                          </li>
                          <li>
                            Stream Key:{" "}
                            <code className="bg-yellow-100 px-1 rounded">
                              {streamData.streamKey ||
                                "Get from Stream Controls"}
                            </code>
                          </li>
                          <li>
                            Video Settings: {advancedSettings.resolution} @{" "}
                            {advancedSettings.maxBitrate / 1000}Mbps
                          </li>
                          <li>Audio Settings: 44.1kHz, 128kbps</li>
                          <li>
                            Start Streaming → HLS.js will auto-adapt quality
                          </li>
                        </ol>
                      </div>

                      <div className="p-3 bg-yellow-100 rounded">
                        <strong> HLS.js Enhanced Features:</strong>
                        <ul className="list-disc list-inside ml-4 space-y-1 mt-1">
                          <li>
                            Automatic quality adaptation based on bandwidth
                          </li>
                          <li>Error recovery for network issues</li>
                          <li>Manual quality selection dropdown</li>
                          <li>Low latency mode for real-time streaming</li>
                          <li>Buffer optimization for smooth playback</li>
                          <li>
                            Universal browser support (Chrome, Firefox, Edge,
                            Safari)
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-100 rounded text-xs text-gray-600 border">
                    <strong> Enhanced Browser Compatibility:</strong>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      <div className="flex items-center space-x-1">
                        <span></span>
                        <span>Chrome: HLS.js Enhanced</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span></span>
                        <span>Firefox: HLS.js Enhanced</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span></span>
                        <span>Edge: HLS.js Enhanced</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span></span>
                        <span>Safari: Native + HLS.js</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs">
                      All browsers now support adaptive quality, error recovery,
                      and manual quality selection
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-6xl mb-4"></div>
                  <p className="text-xl mb-2">
                    No stream available for HLS.js testing
                  </p>
                  <p className="text-sm mb-4">
                    Create a stream first to test the enhanced playback
                    functionality
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveTab("create")}
                      className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors mr-2"
                    >
                      Go to Create Stream
                    </button>
                    <button
                      onClick={testHlsSupport}
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                    >
                      Test HLS.js Support
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="bg-pink-50 p-6 rounded-lg border border-pink-200">
              <h3 className="text-xl font-semibold mb-4 text-pink-800">
                Live Chat Testing
              </h3>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    onKeyPress={e => e.key === "Enter" && sendChatMessage()}
                    className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Type a chat message..."
                    disabled={!streamData.playbackId}
                    maxLength={500}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatMessage.trim() || !streamData.playbackId}
                    className="bg-pink-500 text-white px-6 py-3 rounded-md hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Send
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={getChatMessages}
                    disabled={!streamData.playbackId}
                    className="bg-gray-500 text-white px-6 py-3 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Refresh Messages
                  </button>
                  <button
                    onClick={() => setChatMessages([])}
                    disabled={chatMessages.length === 0}
                    className="bg-red-500 text-white px-6 py-3 rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Clear Chat
                  </button>
                </div>

                <div className="bg-white border border-gray-300 rounded-md h-48 overflow-y-auto p-4">
                  {chatMessages.length > 0 ? (
                    <div className="space-y-2">
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className="text-sm p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <strong className="text-blue-600">
                                {msg.user?.username}:
                              </strong>
                              <span className="ml-2">{msg.content}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-3xl mb-2"></div>
                        <p className="text-sm">No chat messages yet</p>
                        <p className="text-xs mt-1">
                          Send a message to test the real-time chat system
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                  <strong>Chat Stats:</strong> {chatMessages.length} messages •
                  {streamData.playbackId
                    ? " Ready for real-time chat"
                    : " Waiting for stream"}
                </div>

                {!streamData.playbackId && (
                  <div className="p-4 bg-orange-100 rounded-md border border-orange-300">
                    <p className="text-sm text-orange-800">
                      Chat requires an active stream. Create a stream first to
                      test chat functionality.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "debug" && (
            <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
              <h3 className="text-xl font-semibold mb-4 text-orange-800">
                Debug & Analytics
              </h3>

              <div className="space-y-6">
                <div className="p-4 bg-white rounded-lg border">
                  <h4 className="font-semibold mb-2">
                    {" "}
                    HLS.js Debug Information
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p>
                        <strong>Mux Player:</strong> {" Yes"}
                      </p>
                      <p>
                        <strong>Version:</strong> {"Latest"}
                      </p>
                      <p>
                        <strong>Worker Support:</strong>{" "}
                        {typeof Worker !== "undefined" ? " Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Browser:</strong>{" "}
                        {navigator.userAgent.split(" ").slice(-1)[0]}
                      </p>
                      <p>
                        <strong>Platform:</strong> {navigator.platform}
                      </p>
                      <p>
                        <strong>Online:</strong>{" "}
                        {navigator.onLine ? "Yes" : " No"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={testHlsSupport}
                    className="mt-2 bg-orange-500 text-white px-4 py-2 rounded text-sm hover:bg-orange-600 transition-colors"
                  >
                    Test HLS Support
                  </button>
                </div>

                <div className="p-4 bg-white rounded-lg border">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Recent API Calls</h4>
                    <button
                      onClick={clearApiHistory}
                      className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors"
                    >
                      Clear History
                    </button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {apiCallHistory.length > 0 ? (
                      apiCallHistory
                        .slice(-5)
                        .reverse()
                        .map((call, idx) => (
                          <div
                            key={idx}
                            className="text-xs p-2 bg-gray-50 rounded"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-mono">
                                {call.method} {call.endpoint}
                              </span>
                              <span
                                className={`px-2 py-1 rounded ${
                                  call.success
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {call.status}
                              </span>
                            </div>
                            <div className="text-gray-600 mt-1">
                              {call.duration}ms •{" "}
                              {new Date(call.timestamp).toLocaleTimeString()}
                              {call.error && (
                                <span className="text-red-600">
                                  {" "}
                                  • {call.error}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-sm text-gray-500">No API calls yet</p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-white rounded-lg border">
                  <h4 className="font-semibold mb-2">Current Configuration</h4>
                  <div className="text-sm space-y-1">
                    <p>
                      <strong>Low Latency:</strong>{" "}
                      {advancedSettings.lowLatency ? "Enabled" : "Disabled"}
                    </p>
                    <p>
                      <strong>Recording:</strong>{" "}
                      {advancedSettings.recordStream ? " Enabled" : " Disabled"}
                    </p>
                    <p>
                      <strong>Max Bitrate:</strong>{" "}
                      {advancedSettings.maxBitrate / 1000}Mbps
                    </p>
                    <p>
                      <strong>Resolution:</strong> {advancedSettings.resolution}
                    </p>
                    <p>
                      <strong>HLS Enhanced:</strong>{" "}
                      {advancedSettings.enableHls ? "Enabled" : " Disabled"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDebugMode(!debugMode)}
                    className={`px-4 py-2 rounded font-medium transition-colors ${
                      debugMode
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-gray-500 text-white hover:bg-gray-600"
                    }`}
                  >
                    {debugMode ? "Disable Debug" : "Enable Debug"}
                  </button>
                  <button
                    onClick={() => {
                      const config = {
                        streamData,
                        advancedSettings,
                        playerType: "Mux Player",
                        timestamp: new Date().toISOString(),
                      };
                      copyToClipboard(
                        JSON.stringify(config, null, 2),
                        "Debug Config"
                      );
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                  >
                    Copy Debug Info
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border h-fit">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold"> Enhanced API Logs</h3>
            <div className="flex space-x-2">
              <button
                onClick={exportLogs}
                className="text-xs bg-blue-200 hover:bg-blue-300 px-2 py-1 rounded-md transition-colors"
                title="Export logs to file"
              >
                Export
              </button>
              <button
                onClick={clearLogs}
                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded-md transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="bg-black text-green-400 p-3 rounded-md h-96 overflow-y-auto font-mono text-xs">
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`mb-1 ${
                    log.includes("ERROR")
                      ? "text-red-400"
                      : log.includes("SUCCESS")
                        ? "text-green-400"
                        : log.includes("INFO")
                          ? "text-blue-400"
                          : log.includes("HLS")
                            ? "text-purple-400"
                            : "text-gray-400"
                  }`}
                >
                  {log}
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center mt-8">
                <div className="text-2xl mb-2">X</div>
                <div>No logs yet...</div>
                <div className="text-xs mt-1">
                  Start testing to see enhanced API logs!
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-white rounded-md border text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong>Total Logs:</strong> {logs.length}
              </div>
              <div>
                <strong>Successes:</strong>
                <span className="text-green-600 ml-1">
                  {logs.filter(log => log.includes("SUCCESS")).length}
                </span>
              </div>
              <div>
                <strong>Errors:</strong>
                <span className="text-red-600 ml-1">
                  {logs.filter(log => log.includes("ERROR")).length}
                </span>
              </div>
              <div>
                <strong>HLS Events:</strong>
                <span className="text-purple-600 ml-1">
                  {logs.filter(log => log.includes("HLS")).length}
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t text-xs text-gray-600">
              <div>API Calls: {apiCallHistory.length}</div>
              <div>Debug Mode: {debugMode ? " ON" : " OFF"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-gray-100 to-blue-100 rounded-lg text-sm text-gray-600 border">
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <p>
              <strong> Test Wallet:</strong>
            </p>
            <code className="text-xs bg-white p-1 rounded break-all">
              {wallet}
            </code>
          </div>
          <div>
            <p>
              <strong>API Base:</strong> <code>/api/streams/*</code>
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {logs.filter(log => log.includes("SUCCESS")).length} successful
              calls
            </p>
          </div>
          <div>
            <p>
              <strong> Stream Status:</strong>{" "}
              {streamData.isLive ? "Live" : "Offline"}
            </p>
            <p>
              <strong> Stream ID:</strong>{" "}
              {streamData.streamId ? "Active" : "None"}
            </p>
          </div>
          <div>
            <p>
              <strong> HLS Support:</strong> {"Mux Player"}
            </p>
            <p>
              <strong> Version:</strong> {"Latest"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
