import { CloudSun, LayoutDashboard, Leaf, LineChart, Sprout, Stethoscope } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard-link" },
  { to: "/crop-recommender", label: "Crop Advisor", icon: Leaf, testid: "nav-crop-link" },
  { to: "/disease-detector", label: "Disease Scan", icon: Stethoscope, testid: "nav-disease-link" },
  { to: "/weather", label: "Weather", icon: CloudSun, testid: "nav-weather-link" },
  { to: "/market", label: "Mandi Prices", icon: LineChart, testid: "nav-market-link" },
];

export default function Navbar() {
  return (
    <nav
      data-testid="app-navbar"
      className="fixed left-0 right-0 top-0 z-40 border-b border-stone-200/70 bg-white/85 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2" data-testid="brand-logo">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <Sprout className="h-5 w-5" />
          </div>
          <div className="font-display text-lg font-black leading-tight text-stone-900">
            Smart Crop Advisory System
          </div>
        </NavLink>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              data-testid={link.testid}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  isActive ? "bg-emerald-700 text-white shadow-sm" : "text-stone-700 hover:bg-stone-100"
                }`
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex max-w-[55vw] items-center gap-1 overflow-x-auto md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              data-testid={`${link.testid}-mobile`}
              className={({ isActive }) =>
                `rounded-full p-2 transition-all ${
                  isActive ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"
                }`
              }
            >
              <link.icon className="h-5 w-5" />
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
