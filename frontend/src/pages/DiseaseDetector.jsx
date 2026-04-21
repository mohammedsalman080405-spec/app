import { Leaf, Loader2, ShieldCheck, Sprout, Stethoscope, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function DiseaseDetector() {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [cropHint, setCropHint] = useState("");

  function onFile(file) {
    if (!file) {
      return;
    }
    if (!/image\/(png|jpe?g|webp)/i.test(file.type)) {
      toast.error("Please upload a JPG, PNG, or WEBP image");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
    setResult(null);
  }

  async function analyse() {
    if (!preview) {
      toast.error("Please upload a plant image first");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/disease/detect", {
        image_base64: preview,
        crop_hint: cropHint || null,
      });
      setResult(data);
      toast.success("Analysis complete");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to analyse image");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white">
          <Stethoscope className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-black text-stone-900 sm:text-4xl">Plant Disease Detector</h1>
          <p className="mt-1 text-sm text-stone-600">Upload a clear leaf image and get a treatment-oriented diagnosis.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div
            data-testid="disease-dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onFile(event.dataTransfer.files?.[0]);
            }}
            className="flex min-h-[260px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-10 text-center transition-colors hover:bg-emerald-50"
          >
            {preview ? (
              <img data-testid="disease-preview" src={preview} alt="Leaf preview" className="max-h-64 rounded-xl shadow-sm" />
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-white">
                  <Upload className="h-6 w-6 text-emerald-700" />
                </div>
                <div className="font-display text-lg font-bold text-stone-900">Drop leaf image here</div>
                <div className="text-sm text-stone-500">or click to choose · JPG, PNG, WEBP</div>
              </>
            )}
            <input
              data-testid="disease-upload-input"
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => onFile(event.target.files?.[0])}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-stone-600">Crop (optional)</label>
            <input
              data-testid="disease-crop-hint"
              value={cropHint}
              onChange={(event) => setCropHint(event.target.value)}
              placeholder="e.g. Tomato, Wheat, Rice"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            data-testid="disease-analyse-button"
            disabled={!preview || loading}
            onClick={analyse}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analysing leaf...
              </>
            ) : (
              <>
                <Stethoscope className="h-4 w-4" /> Diagnose disease
              </>
            )}
          </button>
        </div>

        <div data-testid="disease-results" className="space-y-4">
          {!result && !loading && (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-12 text-center text-stone-500">
              <Leaf className="mx-auto h-10 w-10 text-stone-300" />
              <p className="mt-3 font-semibold">Diagnosis and treatment plan will appear here.</p>
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-700" />
              <p className="mt-3 text-stone-600">Scanning leaf for diseases, deficiencies, and pests...</p>
            </div>
          )}

          {result && (
            <>
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Diagnosis</div>
                    <div data-testid="disease-name" className="mt-1 font-display text-3xl font-black text-stone-900">
                      {result.disease}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Tag color="emerald">{result.confidence} confidence</Tag>
                    <Tag color={result.severity === "Severe" ? "red" : result.severity === "Mild" ? "stone" : "amber"}>
                      {result.severity} severity
                    </Tag>
                  </div>
                </div>
              </div>

              {result.symptoms?.length > 0 && (
                <Section icon={Leaf} title="Symptoms observed">
                  <ul className="list-inside list-disc space-y-1 text-sm text-stone-700">
                    {result.symptoms.map((symptom, index) => (
                      <li key={index}>{symptom}</li>
                    ))}
                  </ul>
                </Section>
              )}

              {result.treatment?.length > 0 && (
                <Section icon={Stethoscope} title="Treatment plan" highlight>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-stone-100">
                    {result.treatment.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </Section>
              )}

              {result.prevention?.length > 0 && (
                <Section icon={ShieldCheck} title="Prevention">
                  <ul className="list-inside list-disc space-y-1 text-sm text-stone-700">
                    {result.prevention.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ul>
                </Section>
              )}

              {result.organic_remedy && (
                <Section icon={Sprout} title="Organic remedy" amber>
                  <p className="text-sm text-stone-800">{result.organic_remedy}</p>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ color, children }) {
  const colorMap = {
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    stone: "bg-stone-100 text-stone-600",
  };

  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${colorMap[color]}`}>{children}</span>;
}

function Section({ icon: Icon, title, children, highlight = false, amber = false }) {
  const baseClasses = highlight
    ? "bg-emerald-900 text-white"
    : amber
      ? "bg-amber-50 border border-amber-200"
      : "bg-white border border-stone-200";
  const titleClasses = highlight ? "text-emerald-200" : amber ? "text-amber-800" : "text-stone-500";

  return (
    <div className={`${baseClasses} rounded-2xl p-6 shadow-sm`}>
      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] ${titleClasses}`}>
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
