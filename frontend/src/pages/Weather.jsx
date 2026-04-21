import { AlertTriangle, CloudRain, CloudSun, Droplets, Sun, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getWeather } from "@/lib/api";

const REGIONS = [
  "Punjab",
  "Haryana",
  "Uttar Pradesh",
  "Maharashtra",
  "Madhya Pradesh",
  "Karnataka",
  "Tamil Nadu",
  "Gujarat",
  "Rajasthan",
  "Bihar",
  "West Bengal",
];

export default function Weather() {
  const [region, setRegion] = useState("Punjab");
  const [data, setData] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadWeather() {
      try {
        const weatherData = await getWeather(region);
        if (!ignore) {
          setData(weatherData);
        }
      } catch {
        if (!ignore) {
          toast.error("Failed to load weather");
        }
      }
    }

    loadWeather();
    return () => {
      ignore = true;
    };
  }, [region]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white">
            <CloudSun className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-black text-stone-900 sm:text-4xl">Weather Advisory</h1>
            <p className="mt-1 text-sm text-stone-600">Field-level forecast and alerts for smarter irrigation timing.</p>
          </div>
        </div>

        <select
          data-testid="weather-region-select"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {REGIONS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      {data && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-8 text-white">
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="relative">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Now in {data.region}</div>
              <div className="mt-4 font-display text-7xl font-black leading-none" data-testid="weather-temp">
                {data.current.temperature_c}°
              </div>
              <div className="mt-2 flex items-center gap-2 text-stone-100">
                {data.current.condition.includes("Rain") ? <CloudRain className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                {data.current.condition}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <Stat icon={Droplets} label="Humidity" value={`${data.current.humidity}%`} />
                <Stat icon={Wind} label="Wind" value={`${data.current.wind_kph} kph`} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-2">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">5-day forecast</div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {data.forecast.map((forecast, index) => (
                <div
                  key={`${forecast.day}-${index}`}
                  data-testid={`forecast-day-${index}`}
                  className="rounded-xl border border-stone-200 p-4 text-center transition hover:border-emerald-300"
                >
                  <div className="text-xs font-bold uppercase text-stone-500">{forecast.day}</div>
                  <div className="mt-2">
                    {forecast.condition.includes("Rain") ? (
                      <CloudRain className="mx-auto h-6 w-6 text-emerald-700" />
                    ) : (
                      <Sun className="mx-auto h-6 w-6 text-amber-500" />
                    )}
                  </div>
                  <div className="mt-2 font-display text-xl font-bold">{forecast.high}°</div>
                  <div className="text-xs text-stone-500">low {forecast.low}°</div>
                  <div className="mt-1 text-[10px] font-bold text-emerald-700">{forecast.rain_chance}% rain</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Advisories
            </div>
            {data.alerts.length === 0 ? (
              <p className="mt-4 text-stone-600">No active weather advisories for {data.region}. Spray and irrigate as planned.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.alerts.map((alert, index) => (
                  <div key={index} className="rounded-r-xl border-l-4 border-amber-500 bg-amber-50 p-4">
                    <div className="text-sm font-bold text-amber-900">
                      {alert.type} · {alert.severity}
                    </div>
                    <p className="mt-1 text-sm text-stone-800">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-emerald-700/40 bg-emerald-800/50 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-200">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}
