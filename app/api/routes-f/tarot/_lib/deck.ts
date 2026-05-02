interface CardData {
  name: string;
  suit: string;
  upright: string;
  reversed: string;
}

export const TAROT_DECK: CardData[] = [
  // Major Arcana
  { name: "The Fool", suit: "Major Arcana", upright: "New beginnings, innocence, spontaneity", reversed: "Naivety, foolishness, recklessness" },
  { name: "The Magician", suit: "Major Arcana", upright: "Manifestation, resourcefulness, power", reversed: "Manipulation, poor planning, untapped talents" },
  { name: "The High Priestess", suit: "Major Arcana", upright: "Intuition, sacred knowledge, divine feminine", reversed: "Secrets, disconnected from intuition, withdrawal" },
  { name: "The Empress", suit: "Major Arcana", upright: "Femininity, beauty, nature, abundance", reversed: "Creative block, dependence, stagnation" },
  { name: "The Emperor", suit: "Major Arcana", upright: "Authority, structure, control", reversed: "Domination, rigidity, excessive control" },
  { name: "The Hierophant", suit: "Major Arcana", upright: "Spiritual wisdom, religious beliefs, conformity", reversed: "Personal beliefs, freedom, challenging the status quo" },
  { name: "The Lovers", suit: "Major Arcana", upright: "Love, harmony, relationships, values alignment", reversed: "Misalignment of values, conflict, disharmony" },
  { name: "The Chariot", suit: "Major Arcana", upright: "Control, willpower, success, determination", reversed: "Lack of control, lack of direction, aggression" },
  { name: "Strength", suit: "Major Arcana", upright: "Inner strength, courage, patience, control", reversed: "Weakness, self-doubt, lack of confidence" },
  { name: "The Hermit", suit: "Major Arcana", upright: "Soul searching, introspection, inner guidance", reversed: "Isolation, loneliness, withdrawal" },
  { name: "Wheel of Fortune", suit: "Major Arcana", upright: "Good luck, karma, life cycles, destiny", reversed: "Bad luck, resistance to change, breaking cycles" },
  { name: "Justice", suit: "Major Arcana", upright: "Fairness, truth, cause and effect, law", reversed: "Unfairness, lack of accountability, dishonesty" },
  { name: "The Hanged Man", suit: "Major Arcana", upright: "Suspension, surrender, new perspectives", reversed: "Stalling, needless sacrifice, resistance" },
  { name: "Death", suit: "Major Arcana", upright: "Endings, change, transformation, transition", reversed: "Resistance to change, personal transformation, purging" },
  { name: "Temperance", suit: "Major Arcana", upright: "Balance, moderation, patience, purpose", reversed: "Imbalance, excess, self-healing, extremes" },
  { name: "The Devil", suit: "Major Arcana", upright: "Bondage, addiction, materialism, ignorance", reversed: "Breaking free, exploration, personal freedom" },
  { name: "The Tower", suit: "Major Arcana", upright: "Sudden change, upheaval, chaos, revelation", reversed: "Personal transformation, fear of change, avoiding disaster" },
  { name: "The Star", suit: "Major Arcana", upright: "Hope, faith, purpose, rejuvenation", reversed: "Despair, lack of faith, disconnection" },
  { name: "The Moon", suit: "Major Arcana", upright: "Illusion, fear, anxiety, subconscious", reversed: "Confusion, fear, misinterpretation" },
  { name: "The Sun", suit: "Major Arcana", upright: "Joy, success, celebration, positivity", reversed: "Temporary happiness, lack of success, negativity" },
  { name: "Judgement", suit: "Major Arcana", upright: "Judgement, rebirth, inner calling, absolution", reversed: "Doubt, self-judgement, refusal to self-examine" },
  { name: "The World", suit: "Major Arcana", upright: "Completion, integration, accomplishment, travel", reversed: "Seeking closure, short cuts, incomplete" },

  // Minor Arcana - Wands (first few as examples)
  { name: "Ace of Wands", suit: "Wands", upright: "Inspiration, new opportunities, growth, potential", reversed: "Lack of motivation, creative block, delays" },
  { name: "Two of Wands", suit: "Wands", upright: "Future planning, progress, decisions", reversed: "Uncertainty, fear of unknown, lack of planning" },
  { name: "Three of Wands", suit: "Wands", upright: "Expansion, foresight, overseas opportunities", reversed: "Obstacles, delays, lack of preparation" },
  { name: "Four of Wands", suit: "Wands", upright: "Celebration, harmony, marriage, home", reversed: "Unhappy family, conflict, disharmony" },
  { name: "Five of Wands", suit: "Wands", upright: "Competition, conflict, tension, disagreement", reversed: "Avoiding conflict, harmony, collaboration" },
  { name: "Six of Wands", suit: "Wands", upright: "Public recognition, victory, progress", reversed: "Ego, lack of recognition, disappointment" },
  { name: "Seven of Wands", suit: "Wands", upright: "Challenge, competition, courage, perseverance", reversed: "Giving up, overwhelmed, defensive" },
  { name: "Eight of Wands", suit: "Wands", upright: "Speed, action, air travel, communication", reversed: "Delays, frustration, waiting" },
  { name: "Nine of Wands", suit: "Wands", upright: "Resilience, courage, persistence, boundaries", reversed: "Exhaustion, burnout, lack of trust" },
  { name: "Ten of Wands", suit: "Wands", upright: "Burden, responsibility, stress, hard work", reversed: "Taking on too much, spreading yourself too thin" },
  { name: "Page of Wands", suit: "Wands", upright: "Curiosity, exploration, excitement, freedom", reversed: "Boredom, restlessness, distraction" },
  { name: "Knight of Wands", suit: "Wands", upright: "Action, adventure, passion, confidence", reversed: "Impatience, recklessness, insecurity" },
  { name: "Queen of Wands", suit: "Wands", upright: "Vitality, determination, confidence, joy", reversed: "Insecurity, self-doubt, dependence" },
  { name: "King of Wands", suit: "Wands", upright: "Visionary, leadership, creativity, action", reversed: "Impulsiveness, arrogance, unachievable goals" },

  // Minor Arcana - Cups (first few as examples)
  { name: "Ace of Cups", suit: "Cups", upright: "New feelings, love, compassion, creativity", reversed: "Emotional instability, sadness, blocked creativity" },
  { name: "Two of Cups", suit: "Cups", upright: "Partnership, connection, love, union", reversed: "Breakup, conflict, disconnection" },
  { name: "Three of Cups", suit: "Cups", upright: "Friendship, community, celebration", reversed: "Overindulgence, gossip, isolation" },
  { name: "Four of Cups", suit: "Cups", upright: "Apathy, contemplation, reevaluation", reversed: "Opportunity, re-engagement, gratitude" },
  { name: "Five of Cups", suit: "Cups", upright: "Loss, regret, disappointment", reversed: "Moving on, acceptance, forgiveness" },
  { name: "Six of Cups", suit: "Cups", upright: "Reunion, nostalgia, childhood memories", reversed: "Stuck in the past, living in memories" },
  { name: "Seven of Cups", suit: "Cups", upright: "Choices, illusion, fantasy", reversed: "Clear vision, commitment, decision" },
  { name: "Eight of Cups", suit: "Cups", upright: "Disillusionment, walking away, abandonment", reversed: "Hopelessness, despair, giving up" },
  { name: "Nine of Cups", suit: "Cups", upright: "Wish fulfillment, satisfaction, emotional contentment", reversed: "Dissatisfaction, materialism, greed" },
  { name: "Ten of Cups", suit: "Cups", upright: "Harmony, marriage, happiness, alignment", reversed: "Misalignment, conflict, disharmony" },
  { name: "Page of Cups", suit: "Cups", upright: "Creative beginnings, curiosity, intuition", reversed: "Creative block, emotional immaturity, insecurity" },
  { name: "Knight of Cups", suit: "Cups", upright: "Romance, charm, imagination, gestures", reversed: "Moodiness, disappointment, insecurity" },
  { name: "Queen of Cups", suit: "Cups", upright: "Compassion, intuition, emotional security", reversed: "Insecurity, dependency, emotional manipulation" },
  { name: "King of Cups", suit: "Cups", upright: "Emotional balance, control, compassion", reversed: "Emotional instability, manipulation, moodiness" },

  // Minor Arcana - Swords (first few as examples)
  { name: "Ace of Swords", suit: "Swords", upright: "New ideas, clarity, breakthrough, success", reversed: "Confusion, lack of clarity, blocked ideas" },
  { name: "Two of Swords", suit: "Swords", upright: "Indecision, difficult choices, stalemate", reversed: "Indecisiveness, confusion, information overload" },
  { name: "Three of Swords", suit: "Swords", upright: "Heartbreak, pain, sorrow, grief", reversed: "Recovery, release, moving on" },
  { name: "Four of Swords", suit: "Swords", upright: "Rest, restoration, contemplation", reversed: "Restlessness, burnout, stress" },
  { name: "Five of Swords", suit: "Swords", upright: "Conflict, tension, loss, defeat", reversed: "Reconciliation, desire to make peace" },
  { name: "Six of Swords", suit: "Swords", upright: "Transition, change, rite of passage", reversed: "Resistance to change, carrying baggage" },
  { name: "Seven of Swords", suit: "Swords", upright: "Deception, strategy, cunning", reversed: "Guilt, deception, getting caught" },
  { name: "Eight of Swords", suit: "Swords", upright: "Isolation, self-imposed restriction, victim mentality", reversed: "Self-acceptance, freedom, new perspectives" },
  { name: "Nine of Swords", suit: "Swords", upright: "Anxiety, fear, worry, nightmares", reversed: "Hope, despair, burden lifting" },
  { name: "Ten of Swords", suit: "Swords", upright: "Rock bottom, betrayal, endings", reversed: "Recovery, regeneration, inevitable change" },
  { name: "Page of Swords", suit: "Swords", upright: "Curiosity, new ideas, communication", reversed: "Gossip, unreliability, superficiality" },
  { name: "Knight of Swords", suit: "Swords", upright: "Action, ambition, change", reversed: "Impulsiveness, recklessness, haste" },
  { name: "Queen of Swords", suit: "Swords", upright: "Independence, intelligence, clarity", reversed: "Isolation, coldness, bitterness" },
  { name: "King of Swords", suit: "Swords", upright: "Intellectual power, authority, truth", reversed: "Manipulation, abuse of power, tyranny" },

  // Minor Arcana - Pentacles (first few as examples)
  { name: "Ace of Pentacles", suit: "Pentacles", upright: "New opportunity, prosperity, manifestation", reversed: "Missed opportunities, poor investments, lack of manifestation" },
  { name: "Two of Pentacles", suit: "Pentacles", upright: "Balance, adaptability, time management", reversed: "Imbalance, disorganization, poor planning" },
  { name: "Three of Pentacles", suit: "Pentacles", upright: "Teamwork, collaboration, learning", reversed: "Lack of teamwork, dysfunction, poor workmanship" },
  { name: "Four of Pentacles", suit: "Pentacles", upright: "Security, stability, conservation", reversed: "Greed, possessiveness, stinginess" },
  { name: "Five of Pentacles", suit: "Pentacles", upright: "Hardship, poverty, isolation", reversed: "Spiritual poverty, rejection, isolation" },
  { name: "Six of Pentacles", suit: "Pentacles", upright: "Generosity, sharing, charity", reversed: "Debt, stinginess, one-sided charity" },
  { name: "Seven of Pentacles", suit: "Pentacles", upright: "Investment, patience, long-term view", reversed: "Lack of patience, long-term frustration" },
  { name: "Eight of Pentacles", suit: "Pentacles", upright: "Apprenticeship, skill development, craftsmanship", reversed: "Lack of passion, unfulfilling work, perfectionism" },
  { name: "Nine of Pentacles", suit: "Pentacles", upright: "Abundance, luxury, self-sufficiency", reversed: "Financial dependence, overspending, vanity" },
  { name: "Ten of Pentacles", suit: "Pentacles", upright: "Wealth, family, legacy, retirement", reversed: "Financial instability, family conflict, lack of support" },
  { name: "Page of Pentacles", suit: "Pentacles", upright: "Manifestation, study, learning", reversed: "Procrastination, lack of commitment, learning difficulties" },
  { name: "Knight of Pentacles", suit: "Pentacles", upright: "Hard work, routine, efficiency", reversed: "Workaholism, boredom, stagnation" },
  { name: "Queen of Pentacles", suit: "Pentacles", upright: "Practicality, comfort, nature", reversed: "Imbalance, smothering, financial dependence" },
  { name: "King of Pentacles", suit: "Pentacles", upright: "Security, abundance, wealth", reversed: "Greedy, controlling, possessive" },
];

export const SPREAD_POSITIONS = {
  single: ["Card"],
  "three-card": ["Past", "Present", "Future"],
  "celtic-cross": [
    "Present Situation",
    "Challenge",
    "Past",
    "Future",
    "Above",
    "Below",
    "Advice",
    "External Influences",
    "Hopes/Fears",
    "Outcome",
  ],
};
