import React, { useState, useMemo } from 'react';
import { Freelancer } from '../types';
import { 
  Search, 
  MapPin, 
  Tag, 
  Eye, 
  MessageCircle, 
  Sparkles, 
  Users, 
  Filter,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface CatalogViewProps {
  freelancers: Freelancer[];
  loading: boolean;
  onSelectTalent: (talent: Freelancer) => void;
  onContactWa: (talent: Freelancer) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  freelancers,
  loading,
  onSelectTalent,
  onContactWa
}) => {
  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  // Extract unique locations
  const locations = useMemo(() => {
    const set = new Set<string>();
    freelancers.forEach((f) => {
      if (f.location && f.location.trim() && f.location !== '-') {
        set.add(f.location.trim());
      }
    });
    return Array.from(set).sort();
  }, [freelancers]);

  // Filtered freelancers
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return freelancers.filter((f) => {
      const matchName = (f.name || '').toLowerCase().includes(q);
      const matchLoc = !selectedLocation || f.location === selectedLocation;
      return matchName && matchLoc;
    });
  }, [freelancers, search, selectedLocation]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Hero Header */}
      <div className="mb-8 sm:mb-10 text-center max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/80 mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          Katalog Terkurasi PROSS INDO
        </span>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
          Temukan Talenta Freelance Terbaik
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed">
          Hubungkan proyek bisnis Anda dengan freelancer terpercaya. Bebas konsultasi langsung dengan Super Admin melalui WhatsApp.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 mb-8">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex-1 flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama talent..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm font-medium transition-all"
              />
            </div>

            {/* Location Select */}
            <div className="relative min-w-[180px]">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm font-medium bg-white transition-all appearance-none cursor-pointer"
              >
                <option value="">Semua Lokasi</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <Filter className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Results Badge */}
          <div className="text-right sm:text-left self-end sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              {filtered.length} talenta
            </span>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-semibold text-slate-500">Memuat katalog talenta...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base mb-1">
            Belum Ada Talenta yang Sesuai
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search || selectedLocation
              ? 'Coba gunakan kata kunci pencarian lain atau ubah filter lokasi.'
              : 'Super Admin dapat menambahkan data freelancer melalui dashboard admin.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((talent) => {
            let imgList: string[] = [];
            if (Array.isArray(talent.images)) {
              imgList = talent.images;
            } else if (typeof talent.images === 'string') {
              try {
                imgList = JSON.parse(talent.images);
              } catch (e) {
                imgList = talent.images ? [talent.images] : [];
              }
            }

            const thumbnail = (imgList && imgList.length > 0 && imgList[0])
              ? imgList[0]
              : 'https://placehold.co/600x400/e2e8f0/64748b?text=Foto+Talent';

            const isAvailable = talent.status === 'Available';

            return (
              <div
                key={talent.id}
                onClick={() => onSelectTalent(talent)}
                className="bg-white rounded-3xl shadow-xs hover:shadow-xl transition-all duration-300 border border-slate-200/80 overflow-hidden flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  {/* Thumbnail & Status Badge */}
                  <div className="relative h-52 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={thumbnail}
                      alt={talent.name || 'Talenta'}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://placehold.co/600x400/e2e8f0/64748b?text=Foto+Talent';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3.5 left-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-white shadow-md backdrop-blur-sm ${
                          isAvailable ? 'bg-emerald-600/90' : 'bg-red-600/90'
                        }`}
                      >
                        {isAvailable ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {talent.status || 'Available'}
                      </span>
                    </div>

                    {imgList.length > 1 && (
                      <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-lg bg-black/60 text-white text-[10px] font-bold backdrop-blur-xs">
                        +{imgList.length} Foto
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 pb-3">
                    <h3 className="font-extrabold text-slate-900 text-lg tracking-tight mb-2 group-hover:text-blue-600 transition-colors">
                      {talent.name || 'Tanpa Nama'}
                    </h3>

                    <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold mb-2">
                      <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{talent.service || 'Jasa Umum'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{talent.location || 'Indonesia'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-5 pt-0">
                  <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTalent(talent);
                      }}
                      className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-xs font-semibold py-1.5 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Lihat Profil</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onContactWa(talent);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs shadow-xs transition-all active:scale-95"
                      title="Hubungi Admin WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>Hubungi WA</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
