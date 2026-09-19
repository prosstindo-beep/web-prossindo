import React, { useState, useRef, useEffect } from 'react';
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

  // Parsing daftar gambar
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

  // Preload semua gambar talenta di background browser agar tidak ada jeda loading/layar kosong saat digeser
  useEffect(() => {
    if (imgList.length > 1) {
      imgList.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    }
  }, [imgList]);

  // Touch Swipe Gesture State dengan Hardware Accelerated CSS Transform
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentImgIndex((prev) => (prev > 0 ? prev - 1 : imgList.length - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentImgIndex((prev) => (prev < imgList.length - 1 ? prev + 1 : 0));
  };

  // Handler Touch Swipe Gesture Native
  const handleTouchStart = (e: React.TouchEvent) => {
    if (imgList.length <= 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    // Tentukan arah gestur sekali di awal gerakan: apakah geser horizontal atau gulir vertikal
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        isHorizontalSwipe.current = Math.abs(diffX) >= Math.abs(diffY);
      }
    }

    // Jika pengguna sedang menggeser foto secara horizontal, gerakkan slider mengikuti jari secara real-time
    if (isHorizontalSwipe.current === true) {
      // Terapkan sedikit resistensi saat di ujung foto pertama atau terakhir
      let currentOffset = diffX;
      if (
        (currentImgIndex === 0 && diffX > 0) || 
        (currentImgIndex === imgList.length - 1 && diffX < 0)
      ) {
        currentOffset = diffX * 0.35;
      }
      setDragOffset(currentOffset);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (isHorizontalSwipe.current === true) {
      const threshold = 50; // Ambang batas jarak geser jari dalam piksel
      if (dragOffset < -threshold && currentImgIndex < imgList.length - 1) {
        setCurrentImgIndex((prev) => prev + 1);
      } else if (dragOffset > threshold && currentImgIndex > 0) {
        setCurrentImgIndex((prev) => prev - 1);
      }
    }

    setDragOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalSwipe.current = null;
  };

  const handleImageClick = (idx: number) => {
    // Cegah klik lightbox jika jari sebenarnya sedang menggeser foto
    if (Math.abs(dragOffset) > 10) return;
    onOpenLightbox(imgList, idx);
  };

  const isAvailable = talent.status === 'Available';

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
        {/* Gallery / Carousel Section dengan Hardware Acceleration & Real-time Smooth Slide */}
        <div 
          className="relative w-full aspect-square bg-slate-100 overflow-hidden select-none touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {/* Reel Container yang bergeser mengikuti jari (CSS GPU Transform) */}
          <div 
            className="flex w-full h-full will-change-transform"
            style={{
              transform: `translateX(calc(-${currentImgIndex * 100}% + ${dragOffset}px))`,
              transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1)'
            }}
          >
            {imgList.map((src, idx) => (
              <div 
                key={idx} 
                className="w-full h-full shrink-0 relative bg-slate-100 cursor-zoom-in"
                onClick={() => handleImageClick(idx)}
              >
                <img
                  src={src}
                  alt={`${talent.name} - Foto ${idx + 1}`}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="w-full h-full object-cover pointer-events-none"
                />
              </div>
            ))}
          </div>

          {/* Status Badge */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
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
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all shadow-md active:scale-95"
            title="Perbesar Foto"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Carousel Arrows */}
          {imgList.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-lg active:scale-95 z-10"
                title="Foto Sebelumnya"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-lg active:scale-95 z-10"
                title="Foto Selanjutnya"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Counter Badge & Dots Indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10 pointer-events-none">
                <div className="px-3 py-1 rounded-full bg-black/70 text-white text-xs font-bold backdrop-blur-sm">
                  {currentImgIndex + 1} / {imgList.length}
                </div>
                {/* Dots indicator mini */}
                <div className="flex items-center gap-1">
                  {imgList.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentImgIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

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
              <span>Deskripsi Talent</span>
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
