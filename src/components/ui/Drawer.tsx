import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'lg'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex w-full max-w-full sm:pl-4">
        <div className={`flex h-full w-full flex-col border-l border-[#E1E7EF] bg-white shadow-2xl sm:w-screen ${widthClasses[width]}`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-[#E1E7EF] bg-white px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <h2 className="text-lg font-bold text-[#111111]">{title}</h2>
              {description && (
                <p className="mt-1 text-xs text-[#526070]">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#526070] hover:text-[#111111] hover:bg-[#F8FAFC] transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 border-t border-[#E1E7EF] bg-[#F8FAFC] px-4 py-3 sm:px-6 sm:py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
