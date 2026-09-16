import React from 'react';
import { CurrentUser } from '../types';
import { Shield, ShieldCheck, LogOut, User, LayoutGrid, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentUser: CurrentUser | null;
  currentView: 'login' | 'catalog' | 'detail' | 'admin';
  onChangeView: (view: 'catalog' | 'admin') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentView,
  onChangeView,
  onLogout
}) => {
  if (currentView === 'login') return null;

  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div 
          onClick={() => onChangeView('catalog')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg tracking-wider shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                PROSS INDO
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                Verified Network
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Direktori Talent Freelance & Partner Bisnis
            </p>
          </div>
        </div>

        {/* User Badge & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentUser && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 border border-slate-200 text-xs font-semibold text-slate-700 max-w-[170px] sm:max-w-xs truncate">
              {isAdmin ? (
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              ) : (
                <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
              <span className="truncate">{currentUser.name || currentUser.username}</span>
              {isAdmin && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-blue-600 text-white shrink-0 hidden sm:inline-block">
                  Admin
                </span>
              )}
            </div>
          )}

          {isAdmin && currentView !== 'admin' && (
            <button
              onClick={() => onChangeView('admin')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              title="Dashboard Admin"
            >
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Dashboard Admin</span>
            </button>
          )}

          {isAdmin && currentView === 'admin' && (
            <button
              onClick={() => onChangeView('catalog')}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 border border-blue-200 transition-all active:scale-95"
              title="Lihat Katalog"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Katalog Talent</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            title="Keluar / Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
