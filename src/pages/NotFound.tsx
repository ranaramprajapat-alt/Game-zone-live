import React from "react";
import { navigate } from "@/src/lib/router";

export default function NotFound() {
  return (
    <div className="min-h-[var(--app-height)] lg:min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full text-center">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Page not found</h2>
        <p className="text-slate-500 mb-6 text-sm">That route doesn&apos;t exist.</p>
        <button
          onClick={() => navigate("/")}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

