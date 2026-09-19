import React, { useState, useEffect } from 'react';
import { Freelancer } from '../types';
import { 
  ShieldCheck, 
  X, 
  Eye, 
  EyeOff, 
  Loader2, 
  Phone, 
  MessageCircle, 
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// 1. Modal Login Admin
interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (identifier: string, pass: string) => Promise<boolean>;
  loading: boolean;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  loading
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    const ok = await onLogin(identifier.trim(), password);
    if (ok) {
      setIdentifier('');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Super Admin Portal</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email atau Username
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Masukkan email/username"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi admin"
                className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Sistem dilindungi rate limiter maksimal 5 kali percobaan login per 15 menit.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !identifier.trim() || !password}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memvalidasi Kredensial...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Masuk Dashboard</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. Modal Kontak Admin via WhatsApp
interface ContactWaModalProps {
  isOpen: boolean;
  onClose: () => void;
  talent: Freelancer | null;
  adminWa: string;
  defaultMemberName: string;
  onLogLead: (leadData: { member_name: string; talent_name: string; service: string; reference: string }) => Promise<void>;
}

export const ContactWaModal: React.FC<ContactWaModalProps> = ({
  isOpen,
  onClose,
  talent,
  adminWa,
  defaultMemberName,
  onLogLead
}) => {
  const [memberName, setMemberName] = useState(defaultMemberName || '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Selalu perbarui dan isi otomatis nilai nama member ketika modal dibuka
  useEffect(() => {
    if (isOpen) {
      setMemberName(defaultMemberName || '');
    }
  }, [isOpen, defaultMemberName]);

  if (!isOpen || !talent) return null;

  const cleanWa = adminWa.replace(/[^0-9]/g, '') || '6285111029242';

  const handleSendWa = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalMember = memberName.trim() || defaultMemberName || 'Member';
    const finalNote = note.trim() || 'Katalog Talent PROSS INDO';

    const message = `Halo Admin,\n\nSaya *${finalMember}* ingin Order Talent berikut:\n- Nama: ${talent.name || '-'}\n- Layanan: ${talent.service || '-'}\n- Lokasi: ${talent.location || '-'}\n- Catatan/Kebutuhan: ${note.trim()}\n\nTerima kasih!`;
    const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(message)}`;
    
    // Perbaikan iOS Safari Popup Blocker:
    // Safari memblokir window.open jika dipanggil setelah await asynchronous.
    // Solusi andal: Buka jendela referensi secara langsung pada sinkronisasi klik pengguna
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let waWindow: Window | null = null;
    if (!isMobile) {
      waWindow = window.open('about:blank', '_blank');
    }

    setSubmitting(true);
    try {
      // Pencatatan Lead ke database tetap berjalan
      await onLogLead({
        member_name: finalMember,
        talent_name: talent.name || 'Talent',
        service: talent.service || '-',
        reference: finalNote
      });
    } catch (err) {
      console.warn('Lead log notice:', err);
    } finally {
      setSubmitting(false);
    }

    if (waWindow && !waWindow.closed) {
      waWindow.location.href = waUrl;
    } else {
      // Untuk perangkat mobile (iOS / Android), gunakan navigasi langsung yang kompatibel penuh dengan aplikasi WhatsApp
      window.location.href = waUrl;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-safe bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-100 relative mb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Hubungi Admin via WhatsApp</h3>
          </div>
        </div>

        {/* Info Talent Card */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 mb-5 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shrink-0">
            <img 
              src={
                Array.isArray(talent.images) 
                  ? talent.images[0] 
                  : (talent.images || 'https://placehold.co/100x100?text=Talent')
              } 
              alt={talent.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-slate-900 text-sm truncate">{talent.name}</h4>
            <p className="text-xs text-blue-600 font-medium truncate">{talent.service}</p>
            <p className="text-[11px] text-slate-500 truncate">{talent.location}</p>
          </div>
        </div>

        <form onSubmit={handleSendWa} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Anda (Member / Klien)
            </label>
            <input
              type="text"
              required
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Masukkan nama Anda"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              CATATAN KETUBUHAN/REFERENSI
            </label>
            <textarea
              rows={3}
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder=""
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuka WhatsApp...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-5 h-5" />
                  <span>Hubungi Admin</span>
                  <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. Modal Edit Nomor WhatsApp Admin
interface EditWaModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWa: string;
  onSave: (newWa: string) => Promise<boolean>;
}

export const EditWaModal: React.FC<EditWaModalProps> = ({
  isOpen,
  onClose,
  currentWa,
  onSave
}) => {
  const [waNumber, setWaNumber] = useState(currentWa.replace(/[^0-9]/g, ''));
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = waNumber.replace(/[^0-9]/g, '');
    if (clean.length < 8) return;
    setLoading(true);
    const ok = await onSave(clean);
    setLoading(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Ubah Nomor WhatsApp Admin</h3>
            <p className="text-xs text-slate-500">Nomor tujuan untuk semua lead talenta</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nomor WhatsApp (Kode Negara 62)
            </label>
            <input
              type="text"
              required
              value={waNumber}
              onChange={(e) => setWaNumber(e.target.value)}
              placeholder="6285111029242"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Gunakan format internasional tanpa tanda plus (+), misal 628123456789.
            </p>
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || waNumber.replace(/[^0-9]/g, '').length < 8}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Simpan Perubahan</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. Modal Lightbox Foto Talenta
interface LightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  isOpen,
  onClose,
  images,
  currentIndex,
  onPrev,
  onNext
}) => {
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);

  if (!isOpen || images.length === 0) return null;

  const currentImg = images[currentIndex] || images[0];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Swipe horizontal untuk ganti foto di Lightbox
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        onNext();
      } else {
        onPrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 pb-safe animate-fadeIn select-none"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors z-50 active:scale-95"
        title="Tutup (Esc)"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-6 left-6 text-white/70 font-semibold text-xs bg-black/50 px-3.5 py-1.5 rounded-full backdrop-blur-sm">
        {currentIndex + 1} / {images.length}
      </div>

      <div 
        className="relative max-w-5xl max-h-[85vh] w-full flex items-center justify-center p-2 touch-pan-y"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={currentImg}
          alt={`Foto Talenta ${currentIndex + 1}`}
          className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl transition-transform duration-300 pointer-events-none"
        />

        {images.length > 1 && (
          <>
            <button
              onClick={onPrev}
              className="absolute left-2 sm:-left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-xl active:scale-90"
              title="Foto Sebelumnya"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={onNext}
              className="absolute right-2 sm:-right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-xl active:scale-90"
              title="Foto Selanjutnya"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
