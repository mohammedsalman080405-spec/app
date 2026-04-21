import { Droplets, Leaf, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const SOILS = ["Loamy", "Clay", "Sandy", "Silty", "Peaty", "Black", "Red", "Alluvial"];
const SEASONS = ["Kharif (Monsoon)", "Rabi (Winter)", "Zaid (Summer)"];
const REGIONS = [
  "Punjab",
  "Haryana",
  "Uttar Pradesh",
  "Maharashtra",
  "Madhya Pradesh",
  "Karnataka",
  "Tamil Nadu",
  "Andhra Pradesh",
  "Gujarat",
  "Rajasthan",
  "Bihar",
  "West Bengal",
];

export default function CropRecommender() {
  const [form, setForm] = useState({
    soil_type: "Loamy",
    season: "Kharif (Monsoon)",
    region: "Punjab",
    nitrogen: 60,
    phosphorus: 40,
    potassium: 40,
    ph: 6.5,
    rainfall_mm: 800,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function updateField(key, isNumeric = false) {
    return (event) => {
      setForm((current) => ({
        ...current,
        [key]: isNumeric ? Number(event.target.value) : event.target.value,
      }));
    };
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const { data } = await api.post("/crop/recommend", form);
      setResult(data);
      toast.success("Recommendations ready");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to fetch recommendations");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white">
          <Leaf className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-black text-stone-900 sm:text-4xl">Crop Recommender</h1>
          <p className="mt-1 text-sm text-stone-600">Tell us your soil and season to get field-ready crop suggestions.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        <form
          onSubmit={submit}
          data-testid="crop-form"
          className="h-fit space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2"
        >
          <Field label="Soil type">
            <select data-testid="crop-soil-select" value={form.soil_type} onChange={updateField("soil_type")} className={inputCls}>
              {SOILS.map((soil) => (
                <option key={soil}>{soil}</option>
              ))}
            </select>
          </Field>
          <Field label="Season">
            <select data-testid="crop-season-select" value={form.season} onChange={updateField("season")} className={inputCls}>
              {SEASONS.map((season) => (
                <option key={season}>{season}</option>
              ))}
            </select>
          </Field>
          <Field label="Region / State">
            <select data-testid="crop-region-select" value={form.region} onChange={updateField("region")} className={inputCls}>
              {REGIONS.map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nitrogen (N)">
              <input data-testid="crop-n-input" type="number" value={form.nitrogen} onChange={updateField("nitrogen", true)} className={inputCls} />
            </Field>
            <Field label="Phosphorus (P)">
              <input data-testid="crop-p-input" type="number" value={form.phosphorus} onChange={updateField("phosphorus", true)} className={inputCls} />
            </Field>
            <Field label="Potassium (K)">
              <input data-testid="crop-k-input" type="number" value={form.potassium} onChange={updateField("potassium", true)} className={inputCls} />
            </Field>
            <Field label="Soil pH">
              <input data-testid="crop-ph-input" type="number" step="0.1" value={form.ph} onChange={updateField("ph", true)} className={inputCls} />
            </Field>
            <Field label="Rainfall (mm)">
              <input
                data-testid="crop-rain-input"
                type="number"
                value={form.rainfall_mm}
                onChange={updateField("rainfall_mm", true)}
                className={inputCls}
              />
            </Field>
          </div>

          <button
            data-testid="crop-recommend-submit-button"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analysing soil...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Recommend crops
              </>
            )}
          </button>
        </form>

        <div className="space-y-4 lg:col-span-3" data-testid="crop-results">
          {!result && !loading && (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-12 text-center text-stone-500">
              <Leaf className="mx-auto h-10 w-10 text-stone-300" />
              <p className="mt-3 font-semibold">Fill the form to get crop recommendations.</p>
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-700" />
              <p className="mt-3 text-stone-600">Analysing your soil and climate...</p>
            </div>
          )}

          {result && (
            <>
              {result.recommendations.map((recommendation, index) => (
                <div
                  key={`${recommendation.crop}-${index}`}
                  data-testid={`crop-card-${index}`}
                  className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-display text-2xl font-black text-stone-900">{recommendation.crop}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge kind={recommendation.suitability}>{recommendation.suitability} match</Badge>
                        <span className="flex items-center gap-1 text-xs text-stone-500">
                          <Droplets className="h-3 w-3" />
                          {recommendation.water_requirement}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-widest text-stone-500">Yield est.</div>
                      <div className="font-display font-bold text-stone-900">{recommendation.yield_estimate}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-stone-600">{recommendation.reason}</p>
                </div>
              ))}

              {result.fertilizer_tips?.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">Fertilizer Tips</div>
                  <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-stone-800">
                    {result.fertilizer_tips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.general_advice && (
                <div className="rounded-2xl bg-emerald-900 p-6 text-white">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Agronomist Note</div>
                  <p className="mt-2 text-stone-100">{result.general_advice}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-stone-600">{label}</span>
      {children}
    </label>
  );
}

function Badge({ kind, children }) {
  const colorMap = {
    High: "bg-emerald-100 text-emerald-800",
    Medium: "bg-amber-100 text-amber-800",
    Low: "bg-stone-100 text-stone-600",
  };

  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${colorMap[kind] || colorMap.Medium}`}>{children}</span>;
}
