import { useState, useEffect } from 'react';
import { Quote } from 'lucide-react';

const QUOTES = [
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Be the change you wish to see in the world.', author: 'Mahatma Gandhi' },
  { text: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'Kindness is a language the deaf can hear and the blind can see.', author: 'Mark Twain' },
  { text: 'The family is one of nature\'s masterpieces.', author: 'George Santayana' },
  { text: 'A family that plays together, stays together.', author: 'Unknown' },
  { text: 'Happiness is homemade.', author: 'Unknown' },
  { text: 'Together is a wonderful place to be.', author: 'Unknown' },
  { text: 'Home is where love resides, memories are created, and laughter never ends.', author: 'Unknown' },
  { text: 'The love of a family is life\'s greatest blessing.', author: 'Unknown' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
  { text: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Every moment is a fresh beginning.', author: 'T.S. Eliot' },
  { text: 'You are never too old to set another goal or to dream a new dream.', author: 'C.S. Lewis' },
  { text: 'What we think, we become.', author: 'Buddha' },
  { text: 'Not all those who wander are lost.', author: 'J.R.R. Tolkien' },
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'The purpose of our lives is to be happy.', author: 'Dalai Lama' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
];

function getDailyQuote(): typeof QUOTES[0] {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return QUOTES[dayOfYear % QUOTES.length];
}

export function DailyQuote() {
  const [quote, setQuote] = useState(getDailyQuote);

  useEffect(() => {
    const timer = setInterval(() => setQuote(getDailyQuote()), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
      <Quote size={24} className="text-white/20" />
      <p className="text-lg text-white/80 italic leading-relaxed">
        "{quote.text}"
      </p>
      <p className="text-sm text-white/40">— {quote.author}</p>
    </div>
  );
}
