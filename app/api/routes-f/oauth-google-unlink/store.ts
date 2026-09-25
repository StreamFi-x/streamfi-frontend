import type { UserLoginMethods } from "./types";
import { userLoginMethodsStore } from "./seedData";

export class UserNotFoundError extends Error {}
export class GoogleNotLinkedError extends Error {}
export class OnlyLoginMethodError extends Error {}

export function unlinkGoogle(userId: string): UserLoginMethods {
  const user = userLoginMethodsStore.get(userId);
  if (!user) {
    throw new UserNotFoundError(`user '${userId}' not found`);
  }
  if (!user.methods.includes("google")) {
    throw new GoogleNotLinkedError(
      `user '${userId}' does not have a linked Google account`
    );
  }
  if (user.methods.length === 1) {
    throw new OnlyLoginMethodError(
      "cannot unlink Google: it is the only login method for this account"
    );
  }

  const updated: UserLoginMethods = {
    ...user,
    methods: user.methods.filter(method => method !== "google"),
  };
  userLoginMethodsStore.set(userId, updated);

  return updated;
}
