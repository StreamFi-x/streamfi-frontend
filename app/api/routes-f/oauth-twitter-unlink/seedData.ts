import type { UserLoginMethods } from "./types";

// Keyed by user_id.
export const userLoginMethodsStore = new Map<string, UserLoginMethods>([
  [
    "user_twitter_and_password",
    { user_id: "user_twitter_and_password", methods: ["twitter", "password"] },
  ],
  [
    "user_twitter_and_password_2",
    { user_id: "user_twitter_and_password_2", methods: ["twitter", "password"] },
  ],
  [
    "user_twitter_and_google",
    { user_id: "user_twitter_and_google", methods: ["twitter", "google"] },
  ],
  [
    "user_twitter_only",
    { user_id: "user_twitter_only", methods: ["twitter"] },
  ],
  [
    "user_no_twitter",
    { user_id: "user_no_twitter", methods: ["password"] },
  ],
]);
