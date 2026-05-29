export type JokeCategory = "pun" | "knock-knock" | "one-liner";

export type JokeFilterCategory = JokeCategory | "any";

export type JokeEntry = {
  joke: string;
  category: JokeCategory;
};
