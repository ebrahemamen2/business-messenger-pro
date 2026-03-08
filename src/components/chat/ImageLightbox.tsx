import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

const ImageLightbox = ({ src, onClose }: ImageLightboxProps) => {
  const [scale, setScale] = useState(1);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 h-14 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(s + 0.5, 4)); }}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(s - 0.5, 0.5)); }}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <a
            href={src}
            download
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Download className="w-5 h-5" />
          </a>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image */}
      <img
        src={src}
        alt=""
        className="relative z-[1] max-w-[90vw] max-h-[85vh] object-contain rounded-lg transition-transform duration-200 select-none"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  );
};

export default ImageLightbox;
