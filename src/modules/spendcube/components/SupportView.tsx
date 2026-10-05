import React from 'react';
import { HelpCircle, BookOpen, MessageSquare, ExternalLink } from 'lucide-react';

export const SupportView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Support & Documentation</h2>
        <p className="text-xs text-slate-500">Guides for uploading multi-source Excel files and utilizing AI spend analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Upload Guidelines</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Ensure your Excel files (.xlsx) contain standard headers such as <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">HospitalCode</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">VendorName</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">TotalLineAmount</code>, and <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">CreatedDate</code>.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">AI CPO Advisor Support</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            The AI Advisor analyzes your merged SpendCube data securely via Gemini 2.5 Flash, providing executive summaries, supplier risk alerts, and cost-reduction recommendations instantly.
          </p>
        </div>
      </div>
    </div>
  );
};
