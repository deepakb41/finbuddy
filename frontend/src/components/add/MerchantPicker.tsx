import { useState, useRef, useEffect } from "react";

// ── Comprehensive Indian merchant list ────────────────────────────────────────
const INDIAN_MERCHANTS: string[] = [
  // Food delivery
  "Swiggy", "Zomato", "Dunzo", "EatSure", "Box8", "Faasos", "Rebel Foods",
  // Groceries
  "BigBasket", "Blinkit", "Zepto", "Grofers", "DMart", "Reliance Fresh",
  "Spencer's", "Nature's Basket", "JioMart", "More Supermarket", "Star Bazaar",
  // Transport
  "Ola", "Uber", "Rapido", "IRCTC", "RedBus", "IndiGo", "Air India",
  "SpiceJet", "Vistara", "GoFirst", "AirAsia India", "Yulu", "Bounce",
  "Ola Electric",
  // E-commerce
  "Amazon", "Flipkart", "Meesho", "Snapdeal", "Myntra", "Ajio", "Nykaa",
  "Tata Cliq", "Lenskart", "Pepperfry", "Urban Ladder", "FirstCry",
  "Nykaa Fashion", "SUGAR Cosmetics",
  // UPI / Payments
  "PhonePe", "Paytm", "Google Pay", "BHIM", "Mobikwik", "Cred", "FreeCharge",
  // Dining
  "McDonald's", "Domino's", "KFC", "Pizza Hut", "Subway", "Burger King",
  "Starbucks", "CCD", "Haldiram's", "Barbeque Nation", "Chaayos",
  "Wow! Momo", "Biryani By Kilo", "Behrouz Biryani", "Naturals Ice Cream",
  "Baskin-Robbins", "Amul", "Cafe Coffee Day",
  // Streaming & Entertainment
  "Netflix", "Amazon Prime", "Hotstar", "Spotify", "Gaana", "JioCinema",
  "Sony LIV", "Zee5", "YouTube Premium", "Apple Music", "Wynk", "MX Player",
  "BookMyShow", "PVR Cinemas", "INOX",
  // Fuel
  "Indian Oil", "HP", "BPCL", "Shell", "Essar", "Reliance Petroleum",
  // Telecom / Recharge
  "Jio", "Airtel", "Vi", "BSNL", "Tata Play", "Dish TV", "Airtel DTH",
  // Healthcare
  "Practo", "Apollo", "1mg", "Netmeds", "PharmEasy", "Tata Health",
  "Medlife", "MediBuddy", "HealthifyMe",
  // Banking / Finance / Insurance
  "HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak Bank", "Yes Bank",
  "Paytm Bank", "AU Bank", "IDFC Bank", "Bajaj Finance", "LIC", "PolicyBazaar",
  // Utilities
  "BESCOM", "MSEDCL", "Tata Power", "Adani Electricity", "MahaDiscom",
  "BWSSB", "Indane Gas", "HP Gas", "Bharat Gas",
  // Education
  "BYJU'S", "Unacademy", "Vedantu", "upGrad", "Coursera", "Udemy",
  // Fitness
  "Cult.fit", "Gold's Gym", "Anytime Fitness", "Decathlon",
];

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function MerchantPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const lowerVal = value.toLowerCase();
  const suggestions: string[] = [
    ...INDIAN_MERCHANTS.filter(
      (s) => !lowerVal || s.toLowerCase().includes(lowerVal)
    ),
    "Other",
  ];

  // Quick-pick chips shown before any input
  const quickPicks = ["Swiggy", "Zomato", "BigBasket", "Ola", "Amazon", "Other"];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Quick-pick chips — shown when field is empty and dropdown is closed */}
      {!value && !open && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickPicks.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="px-3 py-1 text-xs bg-teal-50 dark:bg-teal-900/30 rounded-full text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder="Search merchant…"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
      />

      {open && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg z-20 overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 dark:hover:bg-teal-900/30 text-gray-700 dark:text-gray-300 ${
                  s === "Other" ? "border-t border-gray-100 dark:border-gray-700 font-medium text-gray-500 dark:text-gray-400" : ""
                }`}
                onClick={() => { onChange(s); setOpen(false); }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
