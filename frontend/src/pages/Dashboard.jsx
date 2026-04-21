import {
  AlertTriangle,
  ArrowUpRight,
  CloudRain,
  Droplets,
  Leaf,
  LineChart,
  Sparkles,
  Stethoscope,
  Sun,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMarketPrices, getWeather } from "@/lib/api";

export default function Dashboard() {
  const [weather, setWeather] = useState(null);
  const [prices, setPrices] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      try {
        const [weatherData, marketData] = await Promise.all([
          getWeather("Punjab"),
          getMarketPrices(),
        ]);
        if (!ignore) {
          setWeather(weatherData);
          setPrices(marketData.slice(0, 4));
        }
      } catch {
        if (!ignore) {
          setWeather(null);
          setPrices([]);
        }
      }
    }

    loadDashboard();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <section
        data-testid="dashboard-hero"
        className="grain relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-amber-700"
      >
        <div className="absolute -left-20 top-6 h-56 w-56 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28rem)]" />
        <div className="relative p-8 text-white sm:p-12 lg:p-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" /> Smart crop intelligence
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-4xl font-black leading-none sm:text-5xl lg:text-6xl">
            Grow smarter. <span className="text-amber-300">Harvest better.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-stone-100/90 sm:text-lg">
            Crop guidance, disease scans, mandi prices, and weather alerts in one field-ready dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              data-testid="cta-crop-recommender"
              to="/crop-recommender"
              className="flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 font-bold text-stone-900 transition hover:bg-amber-300"
            >
              Get Crop Advice <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              data-testid="cta-disease-detector"
              to="/disease-detector"
              className="flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/25"
            >
              Scan Plant Disease <Stethoscope className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
        <div data-testid="widget-weather" className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Weather</span>
            {weather?.current?.condition?.includes("Rain") ? (
              <CloudRain className="h-5 w-5 text-emerald-700" />
            ) : (
              <Sun className="h-5 w-5 text-amber-500" />
            )}
          </div>
          <div className="mt-4 font-display text-5xl font-black text-stone-900">
            {weather ? `${weather.current.temperature_c}°` : "--"}
          </div>
          <div className="mt-1 text-sm text-stone-600">
            {weather ? `${weather.current.condition} · ${weather.region}` : "Loading current weather..."}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-stone-500">
            {weather && (
              <>
                <span className="flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5" />
                  {weather.current.humidity}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="h-3.5 w-3.5" />
                  {weather.current.wind_kph} kph
                </span>
              </>
            )}
          </div>
          <Link to="/weather" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 transition hover:gap-2">
            5-day forecast <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div data-testid="widget-alerts" className="relative overflow-hidden rounded-2xl bg-emerald-900 p-6 text-white md:col-span-2">
          <div className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-emerald-700/40 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Regional Alerts</span>
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            {weather?.alerts?.length ? (
              <div className="mt-4 space-y-3">
                {weather.alerts.map((alert, index) => (
                  <div key={index} className="rounded-xl border border-emerald-700/50 bg-emerald-800/60 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-amber-300">{alert.type}</span>
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-200">{alert.severity}</span>
                    </div>
                    <p className="mt-2 text-sm text-stone-100">{alert.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-stone-200">
                <p className="font-display text-2xl font-bold">All clear.</p>
                <p className="mt-1 text-emerald-200">No active weather advisories for your selected region right now.</p>
              </div>
            )}
          </div>
        </div>

        <div data-testid="widget-market" className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Top Mandi Prices</span>
            <LineChart className="h-5 w-5 text-emerald-700" />
          </div>
          <ul className="mt-4 space-y-3">
            {prices.map((price) => (
              <li key={price.crop} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-stone-900">{price.crop}</span>
                <span className="flex items-center gap-1 font-bold text-stone-900">
                  Rs.{price.price_per_quintal}
                  {price.change_pct >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/market" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 transition hover:gap-2">
            All crops <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <QuickAction
          to="/crop-recommender"
          icon={Leaf}
          title="Crop Recommender"
          desc="Personalized crop picks based on soil and season."
          testid="quick-action-crop"
        />
        <QuickAction
          to="/disease-detector"
          icon={Stethoscope}
          title="Disease Detector"
          desc="Upload a leaf photo and get a guided diagnosis."
          testid="quick-action-disease"
        />
        <QuickAction
          to="/weather"
          icon={CloudRain}
          title="Weather Advisory"
          desc="5-day forecast and field timing support."
          testid="quick-action-weather"
        />
        <QuickAction
          to="/market"
          icon={LineChart}
          title="Mandi Tracker"
          desc="Check crop prices across major Indian markets."
          testid="quick-action-market"
        />
      </section>
    </div>
  );
}

function QuickAction({ to, icon: Icon, title, desc, testid }) {
  return (
    <Link
      to={to}
      data-testid={testid}
      className="group rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-700 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 font-display text-lg font-bold text-stone-900">{title}</div>
      <p className="mt-1 text-sm text-stone-600">{desc}</p>
    </Link>
  );
}
