import { Smartphone, ShieldCheck, Cpu, CheckCircle2, Landmark, Lock, Ban, RotateCcw, Building2 } from "lucide-react";

export function Swipe() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 px-4 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Bank</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Auto-sync your bank transactions</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-10 flex flex-col items-center text-center gap-6">

        {/* Coming soon badge */}
        <span className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-bold rounded-full border border-teal-100 dark:border-teal-800 uppercase tracking-wide">
          Coming Soon
        </span>

        <div className="w-20 h-20 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
          <Building2 size={44} className="text-teal-400 dark:text-teal-500" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Connect your bank account
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm">
            We're finalising the integration with India's Account Aggregator framework.
            Once live, your transactions will sync automatically — no manual entry needed.
          </p>
        </div>

        {/* How it works */}
        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 text-left shadow-sm fin-card space-y-4">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">How it will work</p>

          {[
            { step: "1", Icon: Smartphone,   title: "Enter your mobile number",       desc: "The number linked to your bank account." },
            { step: "2", Icon: ShieldCheck,  title: "Approve consent on Setu",         desc: "You'll be redirected to the RBI-regulated Account Aggregator to grant one-time consent. No passwords shared." },
            { step: "3", Icon: Cpu,          title: "AI reads and categorises",        desc: "Transactions are fetched, narrations are parsed by AI, and each one is assigned a category automatically." },
            { step: "4", Icon: CheckCircle2, title: "Review and accept",               desc: "You review suggestions here and accept the ones that look right — they move straight into your transaction history." },
          ].map(({ step, Icon, title, desc }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0 font-bold text-teal-600 dark:text-teal-400 text-sm">
                {step}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon size={15} className="text-teal-500 dark:text-teal-400" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust signals */}
        <div className="w-full grid grid-cols-2 gap-3">
          {[
            { Icon: Landmark,   label: "RBI-regulated AA framework" },
            { Icon: Lock,       label: "Bank-grade encryption" },
            { Icon: Ban,        label: "No passwords stored" },
            { Icon: RotateCcw,  label: "Revoke consent anytime" },
          ].map(({ Icon, label }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 flex items-center gap-2 fin-card">
              <Icon size={16} className="text-teal-500 dark:text-teal-400 flex-shrink-0" />
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-tight">{label}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
