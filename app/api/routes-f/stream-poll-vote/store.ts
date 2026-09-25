import type { Poll } from "./types";
import { pollStore } from "./seedData";

export class PollNotFoundError extends Error {}
export class PollDeadlinePassedError extends Error {}
export class InvalidChoiceIndexError extends Error {}
export class AlreadyVotedError extends Error {}

export function castVote(
  pollId: string,
  choiceIndex: number,
  viewerId: string,
  now: number = Date.now()
): { poll: Poll; votes: number } {
  const poll = pollStore.get(pollId);
  if (!poll) {
    throw new PollNotFoundError(`poll '${pollId}' not found`);
  }

  if (now >= new Date(poll.deadline).getTime()) {
    throw new PollDeadlinePassedError(
      `poll '${pollId}' is past its voting deadline`
    );
  }

  if (choiceIndex < 0 || choiceIndex >= poll.choices.length) {
    throw new InvalidChoiceIndexError(
      `choice_index must be between 0 and ${poll.choices.length - 1}`
    );
  }

  if (poll.voters.has(viewerId)) {
    throw new AlreadyVotedError(
      `viewer '${viewerId}' has already voted on poll '${pollId}'`
    );
  }

  poll.choices[choiceIndex].votes += 1;
  poll.voters.add(viewerId);

  return { poll, votes: poll.choices[choiceIndex].votes };
}
