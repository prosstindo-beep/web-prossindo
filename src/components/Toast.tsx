import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        let bgColor = 'bg-slate-900 text-white border-slate-800';
        let Icon = Info;
        let iconColor = 'text-blue-400';

        if (t.type === 'success') {
          bgColor = 'bg-emerald-900/95 text-white border-emerald-700/60 shadow-emerald-950/20';
          Icon = CheckCircle2;
          iconColor = 'text-emerald-400';
        } else if (t.type === 'error') {
          bgColor = 'bg-red-950/95 text-white border-red-800/60 shadow-red-950/20';
          Icon = AlertCircle;
          iconColor = 'text-red-400';
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 transform translate-y-0 ${bgColor}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-xs font-medium leading-relaxed break-words">
              {t.message}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors shrink-0"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
