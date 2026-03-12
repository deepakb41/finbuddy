import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../hooks/useAuth";

function FinLogo() {
  return <img src="/logo.png" alt="FinBuddy" className="w-16 h-16 mx-auto drop-shadow-lg" />;
}

// ── Add to Home Screen banner ────────────────────────────────────────────────
function A2HSBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as { standalone?: boolean }).standalone;
    if (ios) { setIsIOS(true); setShow(true); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 flex justify-center">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <img src="/logo.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Get the full app experience</p>
            {isIOS ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                For a native app feel with no browser bars — tap{" "}
                <span className="font-semibold text-teal-600 dark:text-teal-400">Share</span>{" "}
                <span className="text-base">⎙</span> in Safari, then{" "}
                <span className="font-semibold text-teal-600 dark:text-teal-400">"Add to Home Screen"</span>
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                Add to your home screen for a native app feel — no browser bars, faster access, works offline.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none flex-shrink-0 -mt-0.5"
          >
            ×
          </button>
        </div>
        {!isIOS && (
          <button
            type="button"
            onClick={handleInstall}
            className="mt-3 w-full py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors"
          >
            Install App
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Login ────────────────────────────────────────────────────────────────
type Step = "contact" | "otp";

export function Login() {
  const { requestOTP, verifyOTP, googleSignIn } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const startCountdown = () => {
    setResendCountdown(30);
    const iv = setInterval(() => {
      setResendCountdown((n) => {
        if (n <= 1) { clearInterval(iv); return 0; }
        return n - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = contact.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      await requestOTP(trimmed);
      setStep("otp");
      startCountdown();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (digits.length === 6) {
      setOtp(digits.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setError("Enter the 6-digit code"); return; }
    setError(null);
    setLoading(true);
    try {
      await verifyOTP(contact.trim(), code);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setLoading(true);
    try {
      await requestOTP(contact.trim());
      setOtp(["", "", "", "", "", ""]);
      startCountdown();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setError(null);
    setGoogleLoading(true);
    try {
      await googleSignIn(credentialResponse.credential);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <A2HSBanner />
      <div className="min-h-screen bg-teal-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Logo + Branding */}
          <div className="text-center mb-8">
            <FinLogo />
            <h1 className="text-3xl font-bold text-teal-700 dark:text-teal-400 mt-3">FinBuddy</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your personal finance tracker</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-5">
            {step === "contact" ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sign in / Sign up</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Choose how you'd like to continue</p>
                </div>

                {/* Google Sign-In */}
                <div>
                  {googleLoading ? (
                    <div className="flex items-center justify-center gap-2 py-3">
                      <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Signing in…</span>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Google sign-in failed")}
                        theme="outline"
                        size="large"
                        width="320"
                        text="continue_with"
                        shape="rectangular"
                      />
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">or sign in with email</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                </div>

                {/* Email OTP */}
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Email
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      placeholder="you@example.com"
                    />
                  </div>

                  {error && <p className="text-sm text-red-500">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading || !contact.trim()}
                    className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Sending…" : "Send OTP →"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div>
                  <button
                    type="button"
                    onClick={() => { setStep("contact"); setOtp(["", "", "", "", "", ""]); setError(null); }}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline mb-2"
                  >
                    ← Change email
                  </button>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Enter your code</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Sent to <span className="font-medium text-gray-600 dark:text-gray-300">{contact}</span>
                  </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-11 h-12 text-center text-xl font-bold border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-300 transition-colors"
                      />
                    ))}
                  </div>

                  {error && <p className="text-sm text-red-500">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading || otp.join("").length < 6}
                    className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Verifying…" : "Verify & Continue"}
                  </button>

                  <p className="text-center text-sm text-gray-400 dark:text-gray-500">
                    Didn't get it?{" "}
                    {resendCountdown > 0 ? (
                      <span>Resend in {resendCountdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        className="text-teal-600 dark:text-teal-400 font-medium hover:underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
