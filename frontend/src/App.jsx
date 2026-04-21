import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";

const Chatbot = lazy(() => import("@/components/Chatbot"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const CropRecommender = lazy(() => import("@/pages/CropRecommender"));
const DiseaseDetector = lazy(() => import("@/pages/DiseaseDetector"));
const Weather = lazy(() => import("@/pages/Weather"));
const Market = lazy(() => import("@/pages/Market"));

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Navbar />
        <Suspense fallback={<PageShell />}>
          <main className="min-h-screen pt-20 pb-10">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/crop-recommender" element={<CropRecommender />} />
              <Route path="/disease-detector" element={<DiseaseDetector />} />
              <Route path="/weather" element={<Weather />} />
              <Route path="/market" element={<Market />} />
            </Routes>
          </main>
        </Suspense>
        <Suspense fallback={null}>
          <Chatbot />
        </Suspense>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </div>
  );
}

function PageShell() {
  return (
    <main className="min-h-screen pt-20 pb-10">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse rounded-3xl border border-stone-200 bg-white/70 p-8 shadow-sm">
          <div className="h-5 w-32 rounded-full bg-stone-200" />
          <div className="mt-6 h-14 w-3/4 rounded-2xl bg-stone-200" />
          <div className="mt-4 h-4 w-1/2 rounded-full bg-stone-100" />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="h-32 rounded-2xl bg-stone-100" />
            <div className="h-32 rounded-2xl bg-stone-100" />
            <div className="h-32 rounded-2xl bg-stone-100" />
          </div>
        </div>
      </div>
    </main>
  );
}
