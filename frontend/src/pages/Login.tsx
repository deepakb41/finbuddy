import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function FinLogo() {
  return <img src="/logo.png" alt="FinBuddy" className="w-16 h-16 mx-auto drop-shadow-lg" />;
}

type Step = "contact" | "otp";

export function Login() {
  const { requestOTP, verifyOTP } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

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

  return (
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
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">We'll send you a one-time code</p>
              </div>

              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    autoFocus
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
                  {loading ? "Sending…" : "Send OTP"}
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
                {/* 6-digit OTP boxes */}
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
  );
}
