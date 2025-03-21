import { redirect } from "next/navigation";

export default function Settings() {
  redirect("/settings/profile"); // Redirect immediately
  return null; // Prevent rendering anything
}
