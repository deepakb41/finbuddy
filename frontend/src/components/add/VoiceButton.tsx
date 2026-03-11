import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useVoiceInput } from "../../hooks/useVoiceInput";

interface ParsedValues {
  amount?: number | null;
  merchant?: string | null;
  notes?: string | null;
  tx_type?: string;
  category?: string | null;
}

interface Props {
  onParsed: (values: ParsedValues) => void;
}

export function VoiceButton({ onParsed }: Props) {
  const { isListening, transcript, parsed, error, startListening, stopListening } = useVoiceInput();
  const [suggestion, setSuggestion] = useState<ParsedValues | null>(null);
  const [parsedRef, setParsedRef] = useState<ParsedValues | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [added, setAdded] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: () => {
      const s = suggestion!;
      const today = new Date().toISOString().slice(0, 10);
      return api.transactions.create({
        date: today,
        merchant_raw: s.merchant || "Voice entry",
        amount: s.amount || 0,
        currency: localStorage.getItem("finbuddy_currency") || "INR",
        tx_type: s.tx_type === "investment" ? "expense" : (s.tx_type as "expense" | "income") || "expense",
        category: s.category || undefined,
        notes: s.notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setAdded(true);
      setTimeout(() => {
        setSuggestion(null);
        setAdded(false);
        setSwipeX(0);
      }, 1200);
    },
  });

  useEffect(() => {
    if (parsed && (parsed.amount || parsed.merchant) && parsed !== parsedRef) {
      setParsedRef(parsed);
      setSuggestion(parsed);
      setSwipeX(0);
      setAdded(false);
    }
  }, [parsed, parsedRef]);

  const handleAccept = () => {
    if (suggestion) {
      onParsed(suggestion);
      setSuggestion(null);
    }
  };

  const handleDirectAdd = () => {
    if (suggestion && !addMutation.isPending) {
      addMutation.mutate();
    }
  };

  const handleDismiss = () => {
    setSuggestion(null);
    setSwipeX(0);
  };

  const handleRetry = () => {
    setSuggestion(null);
    setParsedRef(null);
    setSwipeX(0);
    startListening();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    setSwipeX(Math.max(-120, Math.min(120, dx)));
  };

  const handleTouchEnd = () => {
    if (swipeX > 80) {
      handleDirectAdd();
    } else if (swipeX < -80) {
      handleDismiss();
    }
    setSwipeX(0);
    touchStartX.current = null;
  };

  if (suggestion) {
    const swipeRight = swipeX > 40;
    const swipeLeft = swipeX < -40;
    const cardBg = swipeRight
      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
      : swipeLeft
      ? "bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700"
      : "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700";

    if (added) {
      return (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-xl p-3 text-center">
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">✅ Added directly!</p>
        </div>
      );
    }

    return (
      <div
        className={`border rounded-xl p-3 space-y-2 select-none transition-colors duration-150 ${cardBg}`}
        style={{ transform: `translateX(${swipeX * 0.3}px)`, transition: swipeX === 0 ? "transform 0.2s ease" : "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide">Detected transaction</p>
          {swipeRight && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">→ Add</span>}
          {swipeLeft && <span className="text-xs font-bold text-rose-500 dark:text-rose-400">← Dismiss</span>}
        </div>
        <div className="space-y-0.5">
          {suggestion.merchant && <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{suggestion.merchant}</p>}
          {suggestion.amount && <p className="text-xl font-bold text-teal-600 dark:text-teal-400">₹{suggestion.amount}</p>}
          {suggestion.category && <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.category}</p>}
          {suggestion.notes && <p className="text-xs text-gray-400 dark:text-gray-500 italic">"{suggestion.notes}"</p>}
        </div>
        {transcript && <p className="text-xs text-gray-400 dark:text-gray-500 italic">Heard: "{transcript}"</p>}
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">← swipe to dismiss · swipe to add →</p>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleDirectAdd} disabled={addMutation.isPending}
            className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {addMutation.isPending ? "Adding…" : "✓ Add now"}
          </button>
          <button type="button" onClick={handleAccept}
            className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors">
            ✎ Fill form
          </button>
          <button type="button" onClick={handleRetry}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            🎤
          </button>
          <button type="button" onClick={handleDismiss}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
          isListening
            ? "bg-red-500 text-white"
            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400"
        }`}
      >
        <span className={`text-lg ${isListening ? "animate-pulse" : ""}`}>{isListening ? "⏹" : "🎤"}</span>
        {isListening ? "Listening… tap to stop" : "Voice Log"}
      </button>
      {transcript && <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Heard: <em>"{transcript}"</em></p>}
      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
    </div>
  );
}
