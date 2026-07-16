"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/**
 * Privacy-first YouTube embed: nothing loads from youtube.com until the
 * visitor clicks play. Before that, only the thumbnail image loads (no
 * tracking cookie), and playback goes through youtube-nocookie.com so no
 * consent-banner gating is needed for this component.
 */
export default function VideoEmbed({
  videoId,
  title,
  className = "",
}: {
  videoId: string;
  title: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className={`relative aspect-video rounded-2xl overflow-hidden bg-black ${className}`}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
      className={`group relative aspect-video w-full rounded-2xl overflow-hidden bg-black ${className}`}
    >
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-70 transition-opacity"
        loading="lazy"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-[#FAFAF7] shadow-lg group-hover:scale-105 transition-transform">
          <Play className="w-6 h-6 text-[#36671E] fill-[#36671E] translate-x-0.5" />
        </span>
      </div>
      <span className="absolute bottom-4 left-4 text-[#FAFAF7] text-sm font-bold drop-shadow">{title}</span>
    </button>
  );
}
