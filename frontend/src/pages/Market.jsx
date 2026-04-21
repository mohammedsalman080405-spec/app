import { LineChart, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { getMarketPrices } from "@/lib/api";

export default function Market() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    getMarketPrices()
      .then((data) => setRows(data))
      .catch(() => setRows([]));
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter(
      (row) =>
        row.crop.toLowerCase().includes(normalizedQuery) ||
        row.market.toLowerCase().includes(normalizedQuery) ||
        row.state.toLowerCase().includes(normalizedQuery)
    );
  }, [deferredQuery, rows]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-700">
        <div className="absolute -left-10 top-2 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute inset-0 flex flex-col justify-center p-8 text-white">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur-sm">
            <LineChart className="h-3 w-3" /> Live mandi data
          </div>
          <h1 className="mt-3 font-display text-3xl font-black sm:text-5xl">Mandi Prices</h1>
          <p className="mt-1 max-w-lg text-sm text-stone-100/90">Track daily APMC crop prices across India and compare markets before selling.</p>
        </div>
      </section>

      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          data-testid="market-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search crop, market, or state..."
          className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" data-testid="market-table">
            <thead className="bg-stone-50 text-stone-600">
              <tr className="[&>th]:px-6 [&>th]:py-3 [&>th]:text-left [&>th]:text-xs [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-[0.2em]">
                <th>Crop</th>
                <th>Market</th>
                <th>State</th>
                <th className="text-right">Price (Rs./quintal)</th>
                <th className="text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={`${row.crop}-${row.market}`} data-testid={`market-row-${index}`} className="border-t border-stone-100 transition hover:bg-stone-50/60">
                  <td className="px-6 py-4 font-display font-bold text-stone-900">{row.crop}</td>
                  <td className="px-6 py-4 text-stone-700">{row.market}</td>
                  <td className="px-6 py-4 text-stone-500">{row.state}</td>
                  <td className="px-6 py-4 text-right font-display text-base font-black text-stone-900">
                    Rs.{row.price_per_quintal.toLocaleString("en-IN")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        row.change_pct >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {row.change_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {row.change_pct >= 0 ? "+" : ""}
                      {row.change_pct}%
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-stone-500">
                    No markets match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
