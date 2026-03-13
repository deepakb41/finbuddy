import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Home, Plus, TrendingUp, Building2, Clock } from "lucide-react";

const tabs = [
  { to: "/",         Icon: Home,        label: "Home",     highlight: false },
  { to: "/insights", Icon: TrendingUp,  label: "Insights", highlight: false },
  { to: "/add",      Icon: Plus,        label: "Add",      highlight: true  },
  { to: "/inbox",    Icon: Building2,   label: "Bank",     highlight: false },
  { to: "/history",  Icon: Clock,       label: "History",  highlight: false },
];

const currentMonth = new Date().toISOString().slice(0, 7);

export function BottomNav() {
  const { data: pending } = useQuery({
    queryKey: ["suggestions-pending", currentMonth],
    queryFn: () => api.suggestions.pending(currentMonth),
    refetchInterval: 30_000,
    select: (d) => d.length,
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 safe-bottom z-50">
      <div className="flex max-w-lg mx-auto items-end">
        {tabs.map((tab) =>
          tab.highlight ? (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className="flex-1 flex flex-col items-center"
            >
              {({ isActive }) => (
                <>
                  <div className={`w-14 h-14 -mt-5 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isActive ? "bg-teal-700" : "bg-teal-500"
                  }`}>
                    <Plus size={26} className="text-white" />
                  </div>
                  <span className={`text-[10px] pb-1 font-semibold ${
                    isActive ? "text-teal-600 dark:text-teal-400" : "text-gray-500 dark:text-gray-400"
                  }`}>Add</span>
                </>
              )}
            </NavLink>
          ) : (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/"}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-xs transition-colors relative ${
                  isActive
                    ? "text-teal-600 dark:text-teal-400 font-semibold"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="mb-0.5 relative inline-block">
                    <tab.Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                    {tab.to === "/inbox" && (pending ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-2 bg-teal-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {(pending ?? 0) > 9 ? "9+" : pending}
                      </span>
                    )}
                  </span>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}
