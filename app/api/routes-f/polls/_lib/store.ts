import { randomUUID } from "crypto";
import type { PollRecord, PublicPoll } from "./types";

const polls = new Map<string, PollRecord>();

function clonePoll(poll: PollRecord): PublicPoll {
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options.map(option => ({ ...option })),
    total_votes: poll.total_votes,
    created_at: poll.created_at,
  };
}

function validateQuestion(question: unknown): string {
  if (typeof question !== "string" || !question.trim()) {
    throw new Error("question is required.");
  }

  return question.trim();
}

function validateOptions(options: unknown): string[] {
  if (!Array.isArray(options)) {
    throw new Error("options must be an array.");
  }

  const normalizedOptions = options
    .map(option => (typeof option === "string" ? option.trim() : ""))
    .filter(Boolean);

  if (normalizedOptions.length < 2 || normalizedOptions.length > 6) {
    throw new Error("options must contain between 2 and 6 items.");
  }

  const uniqueOptions = new Set(
    normalizedOptions.map(option => option.toLowerCase())
  );
  if (uniqueOptions.size !== normalizedOptions.length) {
    throw new Error("options must be unique.");
  }

  return normalizedOptions;
}

export function createPoll(question: unknown, options: unknown): PublicPoll {
  const normalizedQuestion = validateQuestion(question);
  const normalizedOptions = validateOptions(options);

  const poll: PollRecord = {
    id: randomUUID(),
    question: normalizedQuestion,
    options: normalizedOptions.map(option => ({
      text: option,
      vote_count: 0,
    })),
    total_votes: 0,
    created_at: new Date().toISOString(),
    voter_ips: new Set<string>(),
  };

  polls.set(poll.id, poll);

  return clonePoll(poll);
}

export function getPollById(id: string): PublicPoll | null {
  const poll = polls.get(id);
  return poll ? clonePoll(poll) : null;
}

export function voteOnPoll(id: string, optionIndex: unknown, voterIp: string) {
  const poll = polls.get(id);
  if (!poll) {
    throw new Error("Poll not found.");
  }

  const normalizedOptionIndex = Number(optionIndex);

  if (!Number.isInteger(normalizedOptionIndex)) {
    throw new Error("option_index must be an integer.");
  }

  if (
    normalizedOptionIndex < 0 ||
    normalizedOptionIndex >= poll.options.length
  ) {
    throw new Error("option_index is out of range.");
  }

  if (poll.voter_ips.has(voterIp)) {
    throw new Error("This IP address has already voted on this poll.");
  }

  poll.options[normalizedOptionIndex].vote_count += 1;
  poll.total_votes += 1;
  poll.voter_ips.add(voterIp);

  return clonePoll(poll);
}

export function __resetPollStore() {
  polls.clear();
}
