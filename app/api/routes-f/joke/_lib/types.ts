export type JokeCategory = "programming" | "dad" | "pun" | "general";

export interface Joke {
  id: number;
  setup?: string;
  punchline?: string;
  oneliner?: string;
  category: JokeCategory;
}

export interface JokeResponse {
  joke: {
    id: number;
    setup: string | null;
    punchline: string | null;
    category: JokeCategory;
  };
}
