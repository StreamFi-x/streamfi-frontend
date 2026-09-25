import type { UserLoginMethods } from "./types";
import { userLoginMethodsStore } from "./seedData";

export class UserNotFoundError extends Error {}
export class TwitterNotLinkedError extends Error {}
export class OnlyLoginMethodError extends Error {}

export function unlinkTwitter(userId: string): UserLoginMethods {
  const user = userLoginMethodsStore.get(userId);
  if (!user) {
    throw new UserNotFoundError(`user '${userId}' not found`);
  }
  if (!user.methods.includes("twitter")) {
    throw new TwitterNotLinkedError(
      `user '${userId}' does not have a linked Twitter account`
    );
  }
  if (user.methods.length === 1) {
    throw new OnlyLoginMethodError(
      "cannot unlink Twitter: it is the only login method for this account"
    );
  }

  const updated: UserLoginMethods = {
    ...user,
    methods: user.methods.filter(method => method !== "twitter"),
  };
  userLoginMethodsStore.set(userId, updated);

  return updated;
}
