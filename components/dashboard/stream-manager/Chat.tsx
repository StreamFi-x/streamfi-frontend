"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MessageSquare, X, Send, Smile } from "lucide-react";

// Message type definition
type Message = {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  color: string;
};

// Sample initial messages
const initialMessages: Message[] = [
  {
    id: "1",
    username: "Chidinma Cassandra001",
    content: "Wagwan peeps! First viewer joining in today",
    timestamp: Date.now() - 1000 * 60 * 5,
    color: "#9146FF",
  },
  {
    id: "2",
    username: "Chidinma Cassandra001",
    content: "Wow collab ?",
    timestamp: Date.now() - 1000 * 60 * 4,
    color: "#9146FF",
  },
  {
    id: "3",
    username: "Chidinma Cassandra001",
    content: "Wagwan peeps! First viewer joining in today",
    timestamp: Date.now() - 1000 * 60 * 3,
    color: "#9146FF",
  },
  {
    id: "4",
    username: "Onyx ego Cass",
    content: "@Flare Davido! Nye m ego biko.",
    timestamp: Date.now() - 1000 * 60 * 2,
    color: "#FF5700",
  },
  {
    id: "5",
    username: "Onyx ego Cass",
    content: "Nye m ego biko",
    timestamp: Date.now() - 1000 * 60 * 1,
    color: "#FF5700",
  },
  {
    id: "6",
    username: "Spencer Smith",
    content: "what game are we streaming today ?",
    timestamp: Date.now() - 1000 * 30,
    color: "#FF9900",
  },
  {
    id: "7",
    username: "Chidinma Cassandra001",
    content: "Wagwan peeps! First viewer joining in today",
    timestamp: Date.now() - 1000 * 20,
    color: "#9146FF",
  },
  {
    id: "8",
    username: "Lil Nasx twinnle",
    content: "Send Fundz here: 0xc9627dghsahy67k64349qgegsl",
    timestamp: Date.now() - 1000 * 10,
    color: "#1DA1F2",
  },
  {
    id: "9",
    username: "Spencer Smith",
    content: "what game are we streaming today ?",
    timestamp: Date.now() - 1000 * 5,
    color: "#FF9900",
  },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true); // For empty state
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    const storedMessages = localStorage.getItem("chat-messages");
    if (storedMessages) {
      try {
        const parsedMessages = JSON.parse(storedMessages) as Message[];
        // Filter out messages older than 3 hours
        const threeHoursAgo = Date.now() - 1000 * 60 * 60 * 3;
        const recentMessages = parsedMessages.filter(
          msg => msg.timestamp > threeHoursAgo
        );

        if (recentMessages.length > 0) {
          setMessages(recentMessages);
          setIsEmpty(false);
        } else {
          setMessages([]);
          setIsEmpty(true);
        }
      } catch (e) {
        console.error("Error parsing stored messages:", e);
        // For demo purposes, show messages
        setMessages(initialMessages);
        setIsEmpty(false);
      }
    } else {
      // For demo purposes, show messages
      setMessages(initialMessages);
      setIsEmpty(false);
    }
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chat-messages", JSON.stringify(messages));
      setIsEmpty(false);
    } else {
      setIsEmpty(true);
    }
  }, [messages]);

  // Scroll to bottom when messages change
  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    const isAtBottom =
      container &&
      container.scrollHeight - container.scrollTop - container.clientHeight <
        100;

    // if (isAtBottom) {
    //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      username: "You",
      content: newMessage,
      timestamp: Date.now(),
      color: "#00B5AD",
    };

    setMessages((prev: Message[]) => [...prev, newMsg]);
    setNewMessage("");
    setIsEmpty(false);
  };

  if (isMinimized) {
    return (
      <div className="p-2 border-b border-border">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquare size={18} />
          <span>Show Chat</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col h-full rounded-md overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-card p-2 flex justify-between items-center border-b border-border">
        <div className="flex items-center">
          <MessageSquare size={18} className="mr-2 text-foreground" />
          <span className="text-foreground">Chat</span>
        </div>
        <div className="flex space-x-2">
          <button
            className="p-1 hover:bg-gray-100 dark:hover:bg-[#282828] rounded-md transition-colors"
            onClick={() => setIsMinimized(true)}
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide bg-background p-0 relative"
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-sm font-semibold mb-2 text-foreground">
              Your chat room is quiet... for now
            </p>
            <p className="text-xs text-muted-foreground">
              Start the convo! Viewers will be able to chat with you in
              real-time once they join.
            </p>
          </div>
        ) : (
          <div className="p-2 pt-8 pb-16">
            {messages.map(message => (
              <div key={message.id} className="mb-2 flex">
                <div
                  className="w-1 mr-2 rounded-full"
                  style={{ backgroundColor: message.color }}
                ></div>

                <div className="flex-1">
                  <div className="flex">
                    <span
                      className="font-medium"
                      style={{ color: message.color }}
                    >
                      {message.username}
                    </span>
                  </div>
                  <div className="text-xs text-foreground">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSendMessage}
        className="p-2 bg-background border-border border-t flex items-center space-x-2"
      >
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Send a message"
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-purple-600 dark:focus:ring-purple-400 focus:outline-none text-foreground"
        />
        <button
          type="button"
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Smile size={20} />
        </button>
        <button
          type="submit"
          className="p-2 bg-purple-600 hover:bg-purple-700 text-white dark:text-gray-900 rounded-md transition-colors"
          disabled={!newMessage.trim()}
        >
          <Send size={20} />
        </button>
      </form>
    </motion.div>
  );
}
