import React from "react";
import UsernameLayoutClient from "./UsernameLayoutClient";

interface UsernameLayoutProps {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}

export default async function UsernameLayout({
  children,
  params,
}: UsernameLayoutProps) {
  const { username } = await params;
  return (
    <UsernameLayoutClient username={username}>{children}</UsernameLayoutClient>
  );
}
