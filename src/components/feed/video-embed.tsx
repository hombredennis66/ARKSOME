"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

/**
 * Lazy video player:
 * - never autoplays with sound (no autoplay at all; user presses play)
 * - pauses automatically when scrolled off-screen
 * - only fetches media when it comes into view
 */
export function VideoEmbed({
  src,
  poster,
  title,
  duration,
}: {
  src: string;
  poster?: string | null;
  title: string;
  duration?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative aspect-video w-full overflow-hidden bg-muted">
      {inView ? (
        <video
          ref={videoRef}
          className="size-full object-cover"
          controls
          preload="metadata"
          poster={poster ?? undefined}
          playsInline
          title={title}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support embedded video.
        </video>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="absolute inset-0 size-full object-cover opacity-60" loading="lazy" />
          )}
          <span className="relative inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white">
            <Play className="size-4" />
            {duration ? `${duration}s` : "Play"}
          </span>
        </div>
      )}
    </div>
  );
}
