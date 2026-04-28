export type FizzBuzzRule = {
  divisor: number;
  replacement: string;
};

export type FizzBuzzRequestBody = {
  start: number;
  end: number;
  rules?: FizzBuzzRule[];
};

export type FizzBuzzResponse = {
  output: string[];
};
