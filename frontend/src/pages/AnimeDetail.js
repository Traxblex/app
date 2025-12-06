import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Plus, Heart, Star, Clock, Calendar, Check } from 'lucide-react';
import { animeApi, userApi } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

export default function AnimeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [anime, setAnime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [inFavorites, setInFavorites] = useState(false);

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const res = await animeApi.getById(id);
        setAnime(res.data);
        
        if (user) {
          const [watchlistRes, favoritesRes] = await Promise.all([
            userApi.checkWatchlist(user.user_id, id),
            userApi.checkFavorites(user.user_id, id),
          ]);
          setInWatchlist(watchlistRes.data.in_watchlist);
          setInFavorites(favoritesRes.data.in_favorites);
        }
      } catch (error) {
        console.error('Error fetching anime:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnime();
  }, [id, user]);

  const handleWatchlist = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      if (inWatchlist) {
        await userApi.removeFromWatchlist(user.user_id, id);
      } else {
        await userApi.addToWatchlist(user.user_id, id);
      }
      setInWatchlist(!inWatchlist);
    } catch (error) {
      console.error('Error updating watchlist:', error);
    }
  };

  const handleFavorites = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      if (inFavorites) {
        await userApi.removeFromFavorites(user.user_id, id);
      } else {
        await userApi.addToFavorites(user.user_id, id);
      }
      setInFavorites(!inFavorites);
    } catch (error) {
      console.error('Error updating favorites:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-zinc-400">Anime non trouvé</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]" data-testid="anime-detail-page">
      <Navbar />

      {/* Hero Banner */}
      <div className="relative h-[60vh]">
        <div className="absolute inset-0">
          <img
            src={anime.banner_image || anime.cover_image}
            alt={anime.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 hero-gradient"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative -mt-48 px-6 md:px-12 lg:px-16 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Cover Image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-shrink-0"
          >
            <img
              src={anime.cover_image}
              alt={anime.title}
              className="w-48 md:w-64 aspect-[2/3] object-cover rounded-xl shadow-2xl"
            />
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 pt-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="badge badge-primary">
                {anime.status === 'ongoing' ? 'En cours' : 'Terminé'}
              </span>
              {anime.rating && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star size={16} fill="currentColor" />
                  {anime.rating}
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="anime-title">
              {anime.title}
            </h1>
            
            {anime.title_japanese && (
              <p className="text-zinc-400 text-lg mb-4">{anime.title_japanese}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-zinc-400 text-sm mb-4">
              {anime.year && (
                <span className="flex items-center gap-1">
                  <Calendar size={16} />
                  {anime.year}
                </span>
              )}
              {anime.total_episodes && (
                <span className="flex items-center gap-1">
                  <Clock size={16} />
                  {anime.total_episodes} épisodes
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {anime.genres?.map((genre) => (
                <Link
                  key={genre}
                  to={`/browse?genre=${genre}`}
                  className="badge hover:bg-purple-500/20 transition-colors"
                >
                  {genre}
                </Link>
              ))}
            </div>

            <p className="text-zinc-300 mb-6 max-w-2xl">
              {anime.synopsis}
            </p>

            <div className="flex flex-wrap gap-4">
              {anime.episodes?.length > 0 && (
                <Link
                  to={`/watch/${anime.id}/1`}
                  className="btn-primary flex items-center gap-2"
                  data-testid="play-btn"
                >
                  <Play size={20} fill="white" />
                  Regarder EP 1
                </Link>
              )}
              <button
                onClick={handleWatchlist}
                className={`btn-ghost flex items-center gap-2 ${inWatchlist ? 'bg-purple-500/20 border-purple-500' : ''}`}
                data-testid="watchlist-btn"
              >
                {inWatchlist ? <Check size={20} /> : <Plus size={20} />}
                {inWatchlist ? 'Dans ma liste' : 'Ajouter à ma liste'}
              </button>
              <button
                onClick={handleFavorites}
                className={`btn-ghost flex items-center gap-2 ${inFavorites ? 'text-pink-500 border-pink-500' : ''}`}
                data-testid="favorites-btn"
              >
                <Heart size={20} fill={inFavorites ? 'currentColor' : 'none'} />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Episodes List */}
        {anime.episodes?.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-12 mb-12"
          >
            <h2 className="text-2xl font-bold mb-6">Épisodes</h2>
            <div className="grid gap-3" data-testid="episodes-list">
              {anime.episodes.map((episode) => (
                <Link
                  key={episode.number}
                  to={`/watch/${anime.id}/${episode.number}`}
                  className="episode-item flex items-center gap-4"
                >
                  <span className="font-mono text-purple-400 w-12">
                    EP {episode.number.toString().padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{episode.title}</p>
                    {episode.duration && (
                      <p className="text-sm text-zinc-500">{episode.duration}</p>
                    )}
                  </div>
                  <Play size={20} className="text-zinc-500" />
                </Link>
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
