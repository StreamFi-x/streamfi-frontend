import type { JokeCategory, JokeEntry, JokeFilterCategory } from "./types";

export const JOKE_CATEGORIES: readonly JokeCategory[] = ["pun", "knock-knock", "one-liner"];

export const FILTER_CATEGORIES: readonly JokeFilterCategory[] = [
  ...JOKE_CATEGORIES,
  "any",
];

const JOKES: JokeEntry[] = [
  // pun (34)
  { category: "pun", joke: "I used to hate facial hair, but then it grew on me." },
  { category: "pun", joke: "Why don't eggs tell jokes? They'd crack each other up." },
  { category: "pun", joke: "Time flies like an arrow; fruit flies like a banana." },
  { category: "pun", joke: "I wondered why the baseball was getting bigger. Then it hit me." },
  { category: "pun", joke: "A bicycle can't stand on its own because it is two-tired." },
  { category: "pun", joke: "I told my suitcase there would be no vacation this year. Now I'm dealing with emotional baggage." },
  { category: "pun", joke: "The scarecrow won an award because he was outstanding in his field." },
  { category: "pun", joke: "I only know 25 letters of the alphabet. I don't know y." },
  { category: "pun", joke: "Singing in the shower is fun until you get soap in your mouth. Then it becomes a soap opera." },
  { category: "pun", joke: "What do you call a fake noodle? An impasta." },
  { category: "pun", joke: "Why did the coffee file a police report? It got mugged." },
  { category: "pun", joke: "I used to play piano by ear, but now I use my hands." },
  { category: "pun", joke: "What do you call cheese that isn't yours? Nacho cheese." },
  { category: "pun", joke: "I told my wife she was drawing her eyebrows too high. She looked surprised." },
  { category: "pun", joke: "Why don't scientists trust atoms? Because they make up everything." },
  { category: "pun", joke: "What do you call a bear with no teeth? A gummy bear." },
  { category: "pun", joke: "I made a pencil with two erasers. It was pointless." },
  { category: "pun", joke: "What do you call a factory that makes okay products? A satisfactory." },
  { category: "pun", joke: "Why did the math book look sad? It had too many problems." },
  { category: "pun", joke: "I ordered a chicken and an egg online. I'll let you know which comes first." },
  { category: "pun", joke: "What do you call a parade of rabbits hopping backward? A receding hare-line." },
  { category: "pun", joke: "I used to be a baker, but I couldn't make enough dough." },
  { category: "pun", joke: "What do you call a sleeping bull? A bulldozer." },
  { category: "pun", joke: "Why did the picture go to jail? It was framed." },
  { category: "pun", joke: "I told a chemistry joke, but there was no reaction." },
  { category: "pun", joke: "What do you call a belt made of watches? A waist of time." },
  { category: "pun", joke: "Why did the golfer bring two pairs of pants? In case he got a hole in one." },
  { category: "pun", joke: "I used to hate gardening, but then it grew on me." },
  { category: "pun", joke: "What do you call a fish wearing a bowtie? Sofishticated." },
  { category: "pun", joke: "Why don't oysters donate to charity? Because they are shellfish." },
  { category: "pun", joke: "I got fired from the keyboard factory for not putting in enough shifts." },
  { category: "pun", joke: "What do you call a can opener that doesn't work? A can't opener." },
  { category: "pun", joke: "Why did the stadium get hot after the game? All the fans left." },
  { category: "pun", joke: "I named my dog Five Miles so I can tell people I walk Five Miles every day." },
  // one-liner (33)
  { category: "one-liner", joke: "I have a split personality — and we are both comedians." },
  { category: "one-liner", joke: "I'm reading a book about anti-gravity. It's impossible to put down." },
  { category: "one-liner", joke: "My therapist says I have a preoccupation with vengeance. We'll see about that." },
  { category: "one-liner", joke: "I threw a boomerang a few years ago. I now live in constant fear." },
  { category: "one-liner", joke: "I haven't slept for ten days, because that would be too long." },
  { category: "one-liner", joke: "I used to think I was indecisive, but now I'm not so sure." },
  { category: "one-liner", joke: "The early bird might get the worm, but the second mouse gets the cheese." },
  { category: "one-liner", joke: "I told my computer I needed a break, and now it won't stop sending me Kit-Kat ads." },
  { category: "one-liner", joke: "I'm on a whiskey diet. I've lost three days already." },
  { category: "one-liner", joke: "I asked the librarian if the library had books on paranoia. She whispered, 'They're right behind you.'" },
  { category: "one-liner", joke: "I have the heart of a lion and a lifetime ban from the zoo." },
  { category: "one-liner", joke: "My wallet is like an onion — opening it makes me cry." },
  { category: "one-liner", joke: "I don't trust stairs. They're always up to something." },
  { category: "one-liner", joke: "Parallel lines have so much in common. It's a shame they'll never meet." },
  { category: "one-liner", joke: "I told my wife she should embrace her mistakes. She hugged me." },
  { category: "one-liner", joke: "I'm great at multitasking. I can waste time, be unproductive, and procrastinate all at once." },
  { category: "one-liner", joke: "My bed is a magical place where I suddenly remember everything I forgot to do." },
  { category: "one-liner", joke: "I put my phone in airplane mode, but it's not flying." },
  { category: "one-liner", joke: "I'm not arguing, I'm just explaining why I'm right." },
  { category: "one-liner", joke: "Common sense is like deodorant. The people who need it most never use it." },
  { category: "one-liner", joke: "I don't need a hair stylist; my pillow gives me a new hairstyle every morning." },
  { category: "one-liner", joke: "Life is short. Smile while you still have teeth." },
  { category: "one-liner", joke: "I told my plants a joke. They cracked up." },
  { category: "one-liner", joke: "My favorite exercise is a cross between a lunge and a crunch. I call it lunch." },
  { category: "one-liner", joke: "I'm not lazy. I'm on energy-saving mode." },
  { category: "one-liner", joke: "I tried to organize a hide-and-seek tournament, but good players are hard to find." },
  { category: "one-liner", joke: "I'm writing a book about reverse psychology. Do not read it." },
  { category: "one-liner", joke: "My password is the last 16 digits of pi. Nobody can guess that." },
  { category: "one-liner", joke: "I would tell you a construction joke, but I'm still working on it." },
  { category: "one-liner", joke: "I'm afraid for the calendar. Its days are numbered." },
  { category: "one-liner", joke: "I used to be addicted to soap, but I'm clean now." },
  { category: "one-liner", joke: "I told my computer to go to sleep. It said goodnight and closed all my tabs." },
  { category: "one-liner", joke: "I'm not superstitious, but I am a little stitious." },
  { category: "one-liner", joke: "I have a joke about trickle-down economics, but 99% of you won't get it." },
  // knock-knock (33)
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nBoo.\nBoo who?\nDon't cry, it's just a joke!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nLettuce.\nLettuce who?\nLettuce in, it's cold out here!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nOrange.\nOrange who?\nOrange you glad I didn't say banana?",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nAtch.\nAtch who?\nBless you!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nCow says.\nCow says who?\nNo, silly — cow says moo!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nTank.\nTank who?\nYou're welcome!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nHarry.\nHarry who?\nHarry up and answer the door!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nAlpaca.\nAlpaca who?\nAlpaca the suitcase — you load the car!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nInterrupting cow.\nInterrupting cow wh—\nMOO!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nWooden shoe.\nWooden shoe who?\nWooden shoe like to hear another joke?",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nOlive.\nOlive who?\nOlive you and wanted to say hello!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nDishes.\nDishes who?\nDishes the police — open up!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nJustin.\nJustin who?\nJustin time for dinner!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nKen.\nKen who?\nKen we go inside? It's raining!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nLuke.\nLuke who?\nLuke through the peephole and find out!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nNobel.\nNobel who?\nNobel — that's why I knocked!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nDwayne.\nDwayne who?\nDwayne the bathtub — I'm dwowning!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nAmos.\nAmos who?\nA mosquito bit me!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nIce cream.\nIce cream who?\nIce cream if you don't let me in!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nCereal.\nCereal who?\nCereal-sly glad you answered!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nButter.\nButter who?\nButter be quick — I'm melting out here!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nWanda.\nWanda who?\nWanda hang out this weekend?",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nAnnie.\nAnnie who?\nAnnie body home?",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nHoward.\nHoward who?\nHoward I know until you open the door?",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nDoris.\nDoris who?\nDoris locked — that's why I'm knocking!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nYoda lady.\nYoda lady who?\nGood job yodeling!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nMikey.\nMikey who?\nMikey doesn't fit in the lock!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nRadio.\nRadio who?\nRadio not, here I come!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nVenice.\nVenice who?\nVenice your birthday coming up?",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nDonut.\nDonut who?\nDonut ask, donut tell!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nEurope.\nEurope who?\nNo, you're a poo!",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nBroken pencil.\nBroken pencil who?\nNever mind, it's pointless.",
  },
  {
    category: "knock-knock",
    joke: "Knock knock.\nWho's there?\nMustache.\nMustache who?\nMustache you a question, but I'll shave it for later!",
  },
];

export function getJokePool(category: JokeFilterCategory): JokeEntry[] {
  if (category === "any") {
    return JOKES;
  }
  return JOKES.filter((entry) => entry.category === category);
}

export function isFilterCategory(value: string): value is JokeFilterCategory {
  return (FILTER_CATEGORIES as readonly string[]).includes(value);
}
