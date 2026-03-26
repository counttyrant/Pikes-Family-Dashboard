import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { addRecipe, deleteRecipe } from '../services/storage';
import type { Recipe } from '../types';
import {
  ChefHat,
  Mic,
  MicOff,
  Trash2,
  Clock,
  Users,
  Search,
  Save,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

interface RecipesPageProps {
  apiKey: string;
  aiProvider: 'openai' | 'azure-openai';
  azureEndpoint: string;
  azureDeployment: string;
  openaiModel: string;
}

interface AiRecipe {
  title: string;
  ingredients: string[];
  instructions: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
}

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function RecipesPage({
  apiKey,
  aiProvider,
  azureEndpoint,
  azureDeployment,
  openaiModel,
}: RecipesPageProps) {
  const [ingredients, setIngredients] = useState('');
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiRecipe[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const savedRecipes = useLiveQuery(() => db.recipes.orderBy('addedAt').reverse().toArray());

  // ── Voice input ────────────────────────────────────────────────────────

  const toggleVoice = () => {
    setMicError(null);

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setMicError('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setIngredients((prev) => (prev ? `${prev}, ${transcript}` : transcript));
      }
      setListening(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setListening(false);
      if (event.error === 'not-allowed') {
        setMicError('Microphone access denied — check browser permissions');
      } else if (event.error === 'no-speech') {
        setMicError('No speech detected — try again');
      } else {
        setMicError(`Mic error: ${event.error}`);
      }
      setTimeout(() => setMicError(null), 5000);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setMicError('Could not start microphone');
    }
  };

  // ── AI recipe search ───────────────────────────────────────────────────

  const findRecipes = async () => {
    if (!ingredients.trim()) return;
    if (!apiKey) {
      setAiError('No API key configured — add one in Settings');
      return;
    }

    setLoading(true);
    setAiError(null);
    setSuggestions([]);

    try {
      let url: string;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (aiProvider === 'azure-openai' && azureEndpoint && azureDeployment) {
        const base = azureEndpoint.replace(/\/$/, '');
        url = `${base}/openai/deployments/${encodeURIComponent(azureDeployment)}/chat/completions?api-version=2024-02-01`;
        headers['api-key'] = apiKey;
      } else {
        url = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const systemPrompt = `You are a helpful cooking assistant. The user will tell you what ingredients they have. Suggest 3 recipes they can make. For each recipe provide:
- Title
- Ingredients list (as JSON array of strings)
- Instructions (step by step)
- Prep time
- Cook time
- Servings

Respond ONLY with valid JSON in this exact format:
{ "recipes": [{ "title": "...", "ingredients": ["..."], "instructions": "...", "prepTime": "...", "cookTime": "...", "servings": "..." }] }`;

      const body: Record<string, unknown> = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `I have these ingredients: ${ingredients.trim()}` },
        ],
        max_completion_tokens: 2000,
      };

      if (aiProvider !== 'azure-openai') {
        body.model = openaiModel || 'gpt-4o-mini';
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';

      // Parse JSON from the response (handle markdown code fences)
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      setSuggestions(parsed.recipes || []);
    } catch (err) {
      console.error('Recipe AI error:', err);
      setAiError(err instanceof Error ? err.message : 'Failed to get recipes');
    } finally {
      setLoading(false);
    }
  };

  // ── Save / delete ──────────────────────────────────────────────────────

  const handleSave = async (recipe: AiRecipe) => {
    await addRecipe({
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
    });
    // Remove from suggestions after saving
    setSuggestions((prev) => prev.filter((r) => r.title !== recipe.title));
  };

  const handleDelete = async (id: string) => {
    await deleteRecipe(id);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full p-6 pt-16 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-6 pb-24">
        {/* Header */}
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ChefHat size={28} /> Recipes
        </h1>

        {/* Ingredient input section */}
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4 space-y-3">
          <label className="text-sm text-white/70 font-medium">
            What ingredients do you have?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && findRecipes()}
              placeholder="e.g. chicken, rice, garlic, soy sauce…"
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-emerald-400/60 transition-colors"
            />
            <button
              onClick={toggleVoice}
              className={`rounded-xl p-2.5 transition-colors ${
                listening
                  ? 'bg-red-500/80 text-white animate-pulse'
                  : 'bg-white/10 border border-white/20 text-white/70 hover:text-white hover:bg-white/20'
              }`}
              title={listening ? 'Stop listening' : 'Speak ingredients'}
            >
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>

          {micError && (
            <p className="text-red-400 text-xs">{micError}</p>
          )}

          <button
            onClick={findRecipes}
            disabled={loading || !ingredients.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Finding recipes…
              </>
            ) : (
              <>
                <Search size={18} /> Find Recipes
              </>
            )}
          </button>

          {aiError && (
            <p className="text-red-400 text-sm">{aiError}</p>
          )}
        </div>

        {/* AI suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-emerald-400">
              ✨ AI Suggestions
            </h2>
            {suggestions.map((recipe, idx) => (
              <div
                key={idx}
                className="bg-white/5 backdrop-blur-md rounded-2xl border border-emerald-500/20 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold">{recipe.title}</h3>
                  <button
                    onClick={() => handleSave(recipe)}
                    className="flex items-center gap-1 shrink-0 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-3 py-1.5 text-sm font-medium transition-colors"
                  >
                    <Save size={14} /> Save
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-white/60">
                  {recipe.prepTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Prep: {recipe.prepTime}
                    </span>
                  )}
                  {recipe.cookTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Cook: {recipe.cookTime}
                    </span>
                  )}
                  {recipe.servings && (
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {recipe.servings} servings
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm text-white/70 font-medium mb-1">Ingredients:</p>
                  <ul className="list-disc list-inside text-sm text-white/80 space-y-0.5">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm text-white/70 font-medium mb-1">Instructions:</p>
                  <p className="text-sm text-white/80 whitespace-pre-line">
                    {recipe.instructions}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saved recipes */}
        {savedRecipes && savedRecipes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-orange-400">
              📖 Saved Recipes
            </h2>
            {savedRecipes.map((recipe: Recipe) => {
              const expanded = expandedIds.has(recipe.id);
              return (
                <div
                  key={recipe.id}
                  className="bg-white/5 backdrop-blur-md rounded-2xl border border-orange-500/20 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => toggleExpand(recipe.id)}
                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                    >
                      <h3 className="text-lg font-semibold truncate">{recipe.title}</h3>
                      {expanded ? <ChevronUp size={18} className="shrink-0 text-white/50" /> : <ChevronDown size={18} className="shrink-0 text-white/50" />}
                    </button>
                    <button
                      onClick={() => handleDelete(recipe.id)}
                      className="shrink-0 rounded-lg bg-red-600/60 hover:bg-red-600 p-1.5 transition-colors"
                      title="Delete recipe"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-white/60">
                    {recipe.prepTime && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> Prep: {recipe.prepTime}
                      </span>
                    )}
                    {recipe.cookTime && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> Cook: {recipe.cookTime}
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {recipe.servings} servings
                      </span>
                    )}
                  </div>

                  {expanded && (
                    <>
                      <div>
                        <p className="text-sm text-white/70 font-medium mb-1">Ingredients:</p>
                        <ul className="list-disc list-inside text-sm text-white/80 space-y-0.5">
                          {recipe.ingredients.map((ing, i) => (
                            <li key={i}>{ing}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm text-white/70 font-medium mb-1">Instructions:</p>
                        <p className="text-sm text-white/80 whitespace-pre-line">
                          {recipe.instructions}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {(!savedRecipes || savedRecipes.length === 0) && suggestions.length === 0 && !loading && (
          <div className="text-center text-white/40 py-12">
            <ChefHat size={48} className="mx-auto mb-3 opacity-50" />
            <p>Tell us what ingredients you have and we'll suggest recipes!</p>
          </div>
        )}
      </div>
    </div>
  );
}
