export interface Quote {
  id: number;
  text: string;
  author: string;
  category: string;
  year?: number;
}

export const quotes: Quote[] = [
  { id: 1, text: "The best way to predict the future is to invent it.", author: "Alan Kay", category: "technology", year: 1971 },
  { id: 2, text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci", category: "design" },
  { id: 3, text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein", category: "inspiration" },
  { id: 4, text: "It always seems impossible until it's done.", author: "Nelson Mandela", category: "inspiration" },
  { id: 5, text: "The only way to do great work is to love what you do.", author: "Steve Jobs", category: "work" },
  { id: 6, text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House", category: "technology" },
  { id: 7, text: "First, solve the problem. Then, write the code.", author: "John Johnson", category: "technology" },
  { id: 8, text: "Experience is the name everyone gives to their mistakes.", author: "Oscar Wilde", category: "life" },
  { id: 9, text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu", category: "inspiration" },
  { id: 10, text: "Life is what happens when you're busy making other plans.", author: "John Lennon", category: "life" },
];

export function getQuoteById(id: number): Quote | undefined {
  return quotes.find((q) => q.id === id);
}

export function getCategories(): string[] {
  return [...new Set(quotes.map((q) => q.category))];
}

export function getRandomQuote(category?: string): Quote | undefined {
  const pool = category ? quotes.filter((q) => q.category === category) : quotes;
  if (pool.length === 0) {return undefined;}
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getDeterministicQuote(date?: string): Quote {
  const d = date ? new Date(date) : new Date();
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return quotes[dayOfYear % quotes.length];
}
