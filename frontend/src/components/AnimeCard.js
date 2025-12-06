import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Play } from 'lucide-react';

export const AnimeCard = ({ anime }) => {
  return (
    <Link 
      to={`/anime/${anime.id}`} 
      className="anime-card block rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-800/50"
      data-testid={`anime-card-${anime.id}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <img
          src={anime.cover_image || 'https://placehold.co/300x450/1a1a1a/666?text=No+Image'}
          alt={anime.title}
          className="anime-card-image w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500 mx-auto mb-2">
              <Play size={24} fill="white" />
            </div>
          </div>
        </div>

        {/* Rating Badge */}
        {anime.rating && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-sm">
            <Star size={14} className="text-yellow-400" fill="currentColor" />
            <span>{anime.rating}</span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-2 left-2">
          <span className={`badge text-xs ${
            anime.status === 'ongoing' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
          }`}>
            {anime.status === 'ongoing' ? 'En cours' : 'Terminé'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-purple-400 transition-colors">
          {anime.title}
        </h3>
        {anime.genres && anime.genres.length > 0 && (
          <p className="text-xs text-zinc-500 truncate">
            {anime.genres.slice(0, 2).join(' • ')}
          </p>
        )}
      </div>
    </Link>
  );
};

export default AnimeCard;
