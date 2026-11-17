import React from 'react';
import Image from 'next/image';

interface RibbonTrackConfig {
  id: string;
  bgColorClass: string;
  backgroundColor: string;
  rotationClass: string;
  positionClass: string;
  shadowClass: string;
  zIndexClass: string;
  animationClass: string;
  duration: string;
  assetSrc: string;
  altText: string;
}

const RIBBON_TRACKS: RibbonTrackConfig[] = [
  // Strip 1: Bottom Strip - Exact Red #BA200F, moved down from the middle layer
  {
    id: 'ribbon-bottom-red',
    bgColorClass: 'bg-[#BA200F]',
    backgroundColor: '#BA200F',
    rotationClass: 'rotate-[1.5deg]',
    positionClass: 'bottom-0 sm:bottom-0.5',
    shadowClass: 'shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
    zIndexClass: 'z-10',
    animationClass: 'animate-ribbon-left',
    duration: '42s',
    assetSrc: '/images/brand-ribbon-gold.png',
    altText: 'INSPIRATH Festival Brand Ribbon in Gold on Red',
  },
  // Strip 2: Middle Strip - Exact Dark Maroon #2A0C0C, moved up from the bottom layer
  {
    id: 'ribbon-middle-maroon',
    bgColorClass: 'bg-[#2A0C0C]',
    backgroundColor: '#2A0C0C',
    rotationClass: 'rotate-[0.4deg]',
    positionClass: 'bottom-5 sm:bottom-7 md:bottom-8',
    shadowClass: 'shadow-[0_10px_30px_rgba(0,0,0,0.35)]',
    zIndexClass: 'z-20',
    animationClass: 'animate-ribbon-right',
    duration: '56s',
    assetSrc: '/images/brand-ribbon-gold.png',
    altText: 'INSPIRATH Festival Brand Ribbon in Gold on Dark Maroon',
  },
  // Strip 3: Top Strip - Exact Yellow #FDBF0F, moved up from the middle layer
  {
    id: 'ribbon-top-yellow',
    bgColorClass: 'bg-[#FDBF0F]',
    backgroundColor: '#FDBF0F',
    rotationClass: 'rotate-[-1.9deg]',
    positionClass: 'bottom-10 sm:bottom-13 md:bottom-15',
    shadowClass: 'shadow-[0_14px_40px_rgba(0,0,0,0.45)]',
    zIndexClass: 'z-30',
    animationClass: 'animate-ribbon-left',
    duration: '70s',
    assetSrc: '/images/brand-ribbon-red.png',
    altText: 'INSPIRATH Festival Brand Ribbon in Red on Yellow',
  },
];

export function AnimatedBrandRibbon() {
  return (
    <div
      aria-label="INSPIRATH Festival Brand Showcase"
      role="region"
      className="absolute inset-x-0 bottom-[-56px] z-40 w-full overflow-hidden select-none pointer-events-none h-28 sm:h-32 md:h-36 bg-transparent"
    >
      <span className="sr-only">INSPIRATH - Official Festival Brand Showcase</span>

      <div className="relative w-full h-full">
        {RIBBON_TRACKS.map(track => (
          <div
            key={track.id}
            data-ribbon-strip={track.id}
            className={`absolute -left-[5%] w-[110%] sm:-left-[4%] sm:w-[108%] overflow-hidden ${track.positionClass} ${track.rotationClass} ${track.zIndexClass} ${track.bgColorClass} ${track.shadowClass}`}
            style={{
              backgroundColor: track.backgroundColor,
              transformOrigin: 'center center',
            }}
          >
            <div
              className={`flex w-max will-change-transform ${track.animationClass}`}
              style={{
                animationDuration: track.duration,
              }}
            >
              {/* Set 1: Primary Visible Sequence */}
              <div className="flex shrink-0 items-center py-1.5 sm:py-2 md:py-2.5">
                {[...Array(6)].map((_, i) => (
                  <Image
                    key={`set1-${i}`}
                    src={track.assetSrc}
                    alt={i === 0 ? track.altText : ''}
                    aria-hidden={i !== 0}
                    width={1024}
                    height={45}
                    className="h-6 sm:h-7 md:h-8 lg:h-9 w-auto shrink-0 select-none object-contain"
                    draggable={false}
                    unoptimized
                    priority
                  />
                ))}
              </div>

              {/* Set 2: Seamless Duplicate Sequence for Infinite Loop */}
              <div
                className="flex shrink-0 items-center py-1.5 sm:py-2 md:py-2.5"
                aria-hidden="true"
              >
                {[...Array(6)].map((_, i) => (
                  <Image
                    key={`set2-${i}`}
                    src={track.assetSrc}
                    alt=""
                    width={1024}
                    height={45}
                    className="h-6 sm:h-7 md:h-8 lg:h-9 w-auto shrink-0 select-none object-contain"
                    draggable={false}
                    unoptimized
                    priority
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
