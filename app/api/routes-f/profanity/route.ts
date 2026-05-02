import { NextResponse } from "next/server";

const WORD_LIST = [
  "badword", "darn", "heck", "shoot", "crud", "crap", "dang", "freak",
  "jerk", "idiot", "moron", "stupid", "dumb", "suck", "sucks",
  "butt", "bum", "turd", "poop", "pee", "piss", "crapola", "shucks",
  "dagnabbit", "fudge", "gosh", "golly", "jeez", "damn", "bitch", "shit",
  "fuck", "ass"
];

function normalize(text: string): string {
  return text.toLowerCase()
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/(.)\1+/g, '$1');
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (typeof text !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const normalizedText = normalize(text);
    const matches: string[] = [];
    let cleaned = text;

    for (const word of WORD_LIST) {
      if (normalizedText.includes(word)) {
        matches.push(word);
        
        const regexStr = [...word].map(c => {
            switch(c) {
                case 'a': return '[a@4]+';
                case 'o': return '[o0]+';
                case 'i': return '[i1]+';
                case 'e': return '[e3]+';
                case 's': return '[s5]+';
                case 't': return '[t7]+';
                case 'b': return '[b8]+';
                default: return `${c}+`;
            }
        }).join('');
        
        const regex = new RegExp(regexStr, 'gi');
        cleaned = cleaned.replace(regex, '***');
      }
    }

    return NextResponse.json({
      has_profanity: matches.length > 0,
      matches,
      cleaned
    });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
