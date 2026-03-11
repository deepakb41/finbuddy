import { useState, useRef, useCallback } from "react";
import { api } from "../api/client";

interface ParsedTransaction {
  amount: number | null;
  merchant: string | null;
  notes: string | null;
  tx_type: string;
  raw_text: string;
}

interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  parsed: ParsedTransaction | null;
  error: string | null;
}

type Mode = "speech-api" | "whisper";

// Detect if Web Speech API is available
const hasSpeechAPI = typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export function useVoiceInput(mode: Mode = hasSpeechAPI ? "speech-api" : "whisper") {
  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    transcript: "",
    parsed: null,
    error: null,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startListening = useCallback(async () => {
    setState(s => ({ ...s, isListening: true, error: null, transcript: "", parsed: null }));

    if (mode === "speech-api" && hasSpeechAPI) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition: any =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = async (e: any) => {
        const text = e.results[0][0].transcript;
        setState(s => ({ ...s, transcript: text, isListening: false }));
        try {
          const parsed = await api.voice.parse(text);
          setState(s => ({ ...s, parsed }));
        } catch (err) {
          setState(s => ({ ...s, error: "Failed to parse voice input" }));
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        setState(s => ({ ...s, isListening: false, error: `Speech error: ${e.error}` }));
      };

      recognition.onend = () => {
        setState(s => ({ ...s, isListening: false }));
      };

      recognitionRef.current = recognition;
      recognition.start();
    } else {
      // Whisper fallback: record audio, send to API
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          try {
            const result = await api.voice.transcribe(blob);
            const parsed = result.parsed as ParsedTransaction;
            setState(s => ({
              ...s,
              isListening: false,
              transcript: result.transcript,
              parsed,
            }));
          } catch (err) {
            setState(s => ({ ...s, isListening: false, error: "Transcription failed" }));
          }
        };

        recorder.start();
      } catch (err) {
        setState(s => ({ ...s, isListening: false, error: "Microphone access denied" }));
      }
    }
  }, [mode]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setState(s => ({ ...s, isListening: false }));
  }, []);

  return { ...state, startListening, stopListening, hasSpeechAPI };
}
