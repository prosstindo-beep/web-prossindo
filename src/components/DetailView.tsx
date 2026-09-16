import React, { useState } from 'react';
import { Freelancer } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Tag, 
  MessageCircle, 
  Maximize2, 
  CheckCircle2, 
  XCircle,
  FileText
} from 'lucide-react';

interface DetailViewProps {
  talent: Freelancer;
  onBack: () => void;
  onContactWa: (talent: Freelancer) => void;
  onOpenLightbox: (images: string[], index: number) => void;
}

export const DetailView: React.FC<DetailViewProps> = ({
  talent,
  onBack,
  onContactWa,
  onOpenLightbox
}) => {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

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

  if (imgList.length === 0) {
    imgList = ['https://placehold.co/800x600/e2e8f0/64748b?text=Foto+Talenta'];
  }

  const currentImg = imgList[currentImgIndex] || imgList[0];
  const isAvailable = talent.status === 'Available';

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev > 0 ? prev - 1 : imgList.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev < imgList.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fadeIn">
      {/* Back Button */}
      <div className="mb-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-200 font-bold text-xs shadow-xs transition-all active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Kembali ke Katalog</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
        {/* Gallery / Carousel Section */}
        <div className="relative bg-slate-950 flex items-center justify-center h-80 sm:h-96 md:h-[420px] overflow-hidden group">
          <img
            src={currentImg}
            alt={talent.name}
            onClick={() => onOpenLightbox(imgList, currentImgIndex)}
            className="w-full h-full object-contain cursor-zoom-in transition-transform duration-300 group-hover:scale-101"
          />

          {/* Status Badge */}
          <div className="absolute top-4 left-4 z-10">
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white shadow-lg backdrop-blur-md ${
                isAvailable ? 'bg-emerald-600/90' : 'bg-red-600/90'
              }`}
            >
              {isAvailable ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {talent.status || 'Available'}
            </span>
          </div>

          {/* Lightbox Trigger */}
          <button
            onClick={() => onOpenLightbox(imgList, currentImgIndex)}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all shadow-md"
            title="Perbesar Foto"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Carousel Arrows */}
          {imgList.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-lg"
                title="Foto Sebelumnya"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-lg"
                title="Foto Selanjutnya"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Counter Badge */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 text-white text-xs font-bold backdrop-blur-sm">
                {currentImgIndex + 1} / {imgList.length}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail Strip (if multiple photos) */}
        {imgList.length > 1 && (
          <div className="p-3 bg-slate-100 flex gap-2 overflow-x-auto border-b border-slate-200">
            {imgList.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImgIndex(idx)}
                className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                  idx === currentImgIndex ? 'border-blue-600 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Details Content */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {talent.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200/70">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  {talent.service || 'Jasa Umum'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium text-xs">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {talent.location || 'Indonesia'}
                </span>
              </div>
            </div>

            <button
              onClick={() => onContactWa(talent)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] shrink-0"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Hubungi Admin WA</span>
            </button>
          </div>

          {/* Description / Portfolio Details */}
          <div className="pt-6">
            <h3 className="font-extrabold text-slate-900 text-base mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Tentang & Kualifikasi Talenta</span>
            </h3>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
              {talent.description || 'Belum ada deskripsi profil untuk talenta ini.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
