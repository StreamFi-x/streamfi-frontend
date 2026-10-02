import type { UserLoginMethods } from "./types";

// Keyed by user_id.
export const userLoginMethodsStore = new Map<string, UserLoginMethods>([
  [
    "user_google_and_password",
    { user_id: "user_google_and_password", methods: ["google", "password"] },
  ],
  [
    "user_google_and_github",
    { user_id: "user_google_and_github", methods: ["google", "github"] },
  ],
  [
    "user_google_only",
    { user_id: "user_google_only", methods: ["google"] },
  ],
  [
    "user_no_google",
    { user_id: "user_no_google", methods: ["password"] },
  ],
]);
