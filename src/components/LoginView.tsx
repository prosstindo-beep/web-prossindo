import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Loader2, Users, Lock, AlertCircle } from 'lucide-react';

interface LoginViewProps {
  onMemberLogin: (username: string) => Promise<string | null | void>;
  onOpenAdminModal: () => void;
  loading: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onMemberLogin,
  onOpenAdminModal,
  loading
}) => {
  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!username.trim()) return;
    const error = await onMemberLogin(username.trim());
    if (error) {
      setErrorMessage(error);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40">
      <div className="max-w-md w-full my-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            PROSS INDO
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Portal Talent & Partner Terbaik
          </p>
        </div>

        {/* Member Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Portal Member
              </h2>
              <p className="text-xs text-slate-500">
                Akses Katalog Talent Terbaik
              </p>
            </div>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="memberUsernameInput" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Username Member
              </label>
              <input
                id="memberUsernameInput"
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Masukkan Username Anda"
                className={`w-full px-4 py-3.5 rounded-2xl border ${
                  errorMessage ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-slate-200 focus:border-blue-600 focus:ring-blue-100'
                } focus:ring-3 outline-none text-sm font-medium transition-all`}
              />
            </div>

            {errorMessage && (
              <div id="memberLoginErrorAlert" className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  {errorMessage}
                </div>
              </div>
            )}

            <button
              id="btnMemberLoginSubmit"
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memeriksa & Masuk...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Katalog Talent</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <span className="relative bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Khusus Pengelola Sistem
            </span>
          </div>

          {/* Super Admin Trigger */}
          <button
            id="btnOpenAdminLoginModal"
            type="button"
            onClick={onOpenAdminModal}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]"
          >
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Masuk sebagai Super Admin</span>
          </button>
        </div>

        {/* Security Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Koneksi Aman & Terenkripsi</span>
        </div>
      </div>
    </main>
  );
};
