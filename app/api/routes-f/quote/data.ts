import { Quote } from './types';

export const quotes: Quote[] = [
  // Technology
  { id: 1, text: "The best way to predict the future is to invent it.", author: "Alan Kay", category: "technology", year: 1971 },
  { id: 2, text: "Any sufficiently advanced technology is indistinguishable from magic.", author: "Arthur C. Clarke", category: "technology", year: 1973 },
  { id: 3, text: "Software is eating the world.", author: "Marc Andreessen", category: "technology", year: 2011 },
  { id: 4, text: "The future is already here – it's just not evenly distributed.", author: "William Gibson", category: "technology", year: 1993 },
  { id: 5, text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs", category: "technology", year: 1998 },
  { id: 6, text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House", category: "technology", year: 2014 },
  { id: 7, text: "First, solve the problem. Then, write the code.", author: "John Johnson", category: "technology" },
  { id: 8, text: "Experience is the name everyone gives to their mistakes.", author: "Oscar Wilde", category: "technology" },
  { id: 9, text: "The only way to learn a new programming language is by writing programs in it.", author: "Dennis Ritchie", category: "technology" },
  { id: 10, text: "Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday's code.", author: "Dan Salomon", category: "technology" },
  { id: 11, text: "Perfection is achieved not when there is nothing more to add, but rather when there is nothing more to take away.", author: "Antoine de Saint-Exupery", category: "technology" },
  { id: 12, text: "Code never lies, comments sometimes do.", author: "Ron Jeffries", category: "technology" },
  { id: 13, text: "Debugging is twice as hard as writing the code in the first place.", author: "Brian Kernighan", category: "technology" },
  { id: 14, text: "There are only two hard things in Computer Science: cache invalidation and naming things.", author: "Phil Karlton", category: "technology" },
  { id: 15, text: "Walking on water and developing software from a specification are easy if both are frozen.", author: "Edward V. Berard", category: "technology" },
  
  // Inspiration
  { id: 16, text: "The only impossible thing is that which you don't attempt.", author: "Unknown", category: "inspiration" },
  { id: 17, text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill", category: "inspiration", year: 1942 },
  { id: 18, text: "The only way to do great work is to love what you do.", author: "Steve Jobs", category: "inspiration", year: 2005 },
  { id: 19, text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt", category: "inspiration" },
  { id: 20, text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt", category: "inspiration" },
  { id: 21, text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", category: "inspiration" },
  { id: 22, text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair", category: "inspiration" },
  { id: 23, text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", category: "inspiration" },
  { id: 24, text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney", category: "inspiration" },
  { id: 25, text: "Don't let yesterday take up too much of today.", author: "Will Rogers", category: "inspiration" },
  { id: 26, text: "You learn more from failure than from success.", author: "Unknown", category: "inspiration" },
  { id: 27, text: "If you are working on something that you really care about, you don't have to be pushed.", author: "Steve Jobs", category: "inspiration" },
  { id: 28, text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown", category: "inspiration" },
  { id: 29, text: "Dream bigger. Do bigger.", author: "Unknown", category: "inspiration" },
  { id: 30, text: "Success doesn't just find you. You have to go out and get it.", author: "Unknown", category: "inspiration" },
  
  // Business
  { id: 31, text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs", category: "business", year: 2005 },
  { id: 32, text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb", category: "business" },
  { id: 33, text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller", category: "business" },
  { id: 34, text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson", category: "business" },
  { id: 35, text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney", category: "business" },
  { id: 36, text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller", category: "business" },
  { id: 37, text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs", category: "business", year: 1998 },
  { id: 38, text: "Your most unhappy customers are your greatest source of learning.", author: "Bill Gates", category: "business" },
  { id: 39, text: "Chase the vision, not the money; the money will end up following you.", author: "Tony Hsieh", category: "business" },
  { id: 40, text: "The secret of business is to know something that nobody else knows.", author: "Aristotle Onassis", category: "business" },
  { id: 41, text: "It's not about ideas. It's about making ideas happen.", author: "Scott Belsky", category: "business" },
  { id: 42, text: "Every time we launch a feature, I hear from a user that they wish we had done it differently.", author: "Mark Zuckerberg", category: "business" },
  { id: 43, text: "If you're not embarrassed by the first version of your product, you've launched too late.", author: "Reid Hoffman", category: "business" },
  { id: 44, text: "The biggest risk is not taking any risk.", author: "Mark Zuckerberg", category: "business" },
  { id: 45, text: "Move fast and break things. Unless you are breaking stuff, you are not moving fast enough.", author: "Mark Zuckerberg", category: "business" },
  
  // Science
  { id: 46, text: "The important thing in science is not so much to obtain new facts as to discover new ways of thinking about them.", author: "Sir William Bragg", category: "science" },
  { id: 47, text: "Science is organized knowledge. Wisdom is organized life.", author: "Immanuel Kant", category: "science" },
  { id: 48, text: "The most beautiful thing we can experience is the mysterious. It is the source of all true art and science.", author: "Albert Einstein", category: "science" },
  { id: 49, text: "Nothing in life is to be feared, it is only to be understood. Now is the time to understand more, so that we may fear less.", author: "Marie Curie", category: "science" },
  { id: 50, text: "The good thing about science is that it's true whether or not you believe in it.", author: "Neil deGrasse Tyson", category: "science" },
  { id: 51, text: "In science the best credit is the one you give yourself.", author: "James Watson", category: "science" },
  { id: 52, text: "Research is what I'm doing when I don't know what I'm doing.", author: "Wernher von Braun", category: "science" },
  { id: 53, text: "The most exciting phrase to hear in science, the one that heralds new discoveries, is not 'Eureka!' but 'That's funny...'", author: "Isaac Asimov", category: "science" },
  { id: 54, text: "An experiment is a question which science poses to Nature, and a measurement is the recording of Nature's answer.", author: "Max Planck", category: "science" },
  { id: 55, text: "Science is the poetry of reality.", author: "Richard Dawkins", category: "science" },
  { id: 56, text: "The art and science of asking questions is the source of all knowledge.", author: "Thomas Berger", category: "science" },
  { id: 57, text: "Science is not only a disciple of reason but also one of romance and passion.", author: "Stephen Hawking", category: "science" },
  { id: 58, text: "We are just an advanced breed of monkeys on a minor planet of a very average star.", author: "Stephen Hawking", category: "science" },
  { id: 59, text: "The greatest discoveries of science have been due to the art of observation.", author: "John Tyndall", category: "science" },
  { id: 60, text: "Science is the great antidote to the poison of enthusiasm and superstition.", author: "Adam Smith", category: "science" },
  
  // Philosophy
  { id: 61, text: "The unexamined life is not worth living.", author: "Socrates", category: "philosophy" },
  { id: 62, text: "I think, therefore I am.", author: "René Descartes", category: "philosophy" },
  { id: 63, text: "The only true wisdom is in knowing you know nothing.", author: "Socrates", category: "philosophy" },
  { id: 64, text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle", category: "philosophy" },
  { id: 65, text: "The mind is everything. What you think you become.", author: "Buddha", category: "philosophy" },
  { id: 66, text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle", category: "philosophy" },
  { id: 67, text: "The only thing I know is that I know nothing.", author: "Socrates", category: "philosophy" },
  { id: 68, text: "Happiness depends upon ourselves.", author: "Aristotle", category: "philosophy" },
  { id: 69, text: "Wise men speak because they have something to say; fools because they have to say something.", author: "Plato", category: "philosophy" },
  { id: 70, text: "I cannot teach anybody anything, I can only make them think.", author: "Socrates", category: "philosophy" },
  { id: 71, text: "The whole is greater than the sum of its parts.", author: "Aristotle", category: "philosophy" },
  { id: 72, text: "Man is by nature a political animal.", author: "Aristotle", category: "philosophy" },
  { id: 73, text: "Time is the most valuable thing a man can spend.", author: "Theophrastus", category: "philosophy" },
  { id: 74, text: "One cannot step twice in the same river.", author: "Heraclitus", category: "philosophy" },
  { id: 75, text: "God is dead. God remains dead. And we have killed him.", author: "Friedrich Nietzsche", category: "philosophy" },
];

export const getQuoteById = (id: number): Quote | undefined => {
  return quotes.find(quote => quote.id === id);
};

export const getQuotesByCategory = (category: string): Quote[] => {
  return quotes.filter(quote => quote.category === category);
};

export const getRandomQuote = (category?: string): Quote => {
  const availableQuotes = category ? getQuotesByCategory(category) : quotes;
  
  if (availableQuotes.length === 0) {
    throw new Error(`No quotes found for category: ${category}`);
  }
  
  const randomIndex = Math.floor(Math.random() * availableQuotes.length);
  return availableQuotes[randomIndex];
};

export const getDeterministicQuote = (date: string): Quote => {
  // Create a deterministic hash from the date string
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    const char = date.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the hash to select a quote deterministically
  const index = Math.abs(hash) % quotes.length;
  return quotes[index];
};

export const getCategories = (): string[] => {
  return Array.from(new Set(quotes.map(quote => quote.category)));
};
