import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Plus, Star, ChevronRight, Search } from 'lucide-react';
import { animeApi, seedApi, userApi } from '../api';
import { useAuth } from '../context/AuthContext';
import AnimeCard from '../components/AnimeCard';
import Navbar from '../components/Navbar';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First seed the database
        await seedApi.seed().catch(() => {});
        
        const [featuredRes, trendingRes, recentRes] = await Promise.all([
          animeApi.getFeatured(),
          animeApi.getTrending(),
          animeApi.getRecent(),
        ]);
        
        setFeatured(featuredRes.data);
        setTrending(trendingRes.data);
        setRecent(recentRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  useEffect(() => {
    if (featured.length > 0) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % featured.length);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [featured.length]);

  const handleAddToWatchlist = async (animeId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await userApi.addToWatchlist(user.user_id, animeId);
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  };

  const currentFeatured = featured[currentSlide];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]" data-testid="home-page">
      <Navbar />
      
      {/* Hero Section */}
      {currentFeatured && (
        <section className="relative h-[85vh] w-full" data-testid="hero-section">
          {/* Background Image */}
          <div className="absolute inset-0">
            <img
              src={currentFeatured.banner_image || currentFeatured.cover_image}
              alt={currentFeatured.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 hero-gradient"></div>
            <div className="absolute inset-0 hero-mesh"></div>
          </div>

          {/* Content */}
          <div className="relative h-full flex items-end pb-20 px-6 md:px-12 lg:px-16 max-w-7xl mx-auto">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="badge badge-primary">{currentFeatured.status}</span>
                {currentFeatured.rating && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Star size={16} fill="currentColor" />
                    {currentFeatured.rating}
                  </span>
                )}
                {currentFeatured.year && (
                  <span className="text-zinc-400 font-mono text-sm">{currentFeatured.year}</span>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold uppercase mb-2 text-glow">
                {currentFeatured.title}
              </h1>
              
              {currentFeatured.title_japanese && (
                <p className="text-zinc-400 text-lg mb-4">{currentFeatured.title_japanese}</p>
              )}

              <p className="text-zinc-300 text-base mb-6 line-clamp-3">
                {currentFeatured.synopsis}
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {currentFeatured.genres?.slice(0, 4).map((genre) => (
                  <span key={genre} className="badge">{genre}</span>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <Link
                  to={`/anime/${currentFeatured.id}`}
                  className="btn-primary flex items-center gap-2"
                  data-testid="watch-now-btn"
                >
                  <Play size={20} fill="white" />
                  Regarder
                </Link>
                <button
                  onClick={() => handleAddToWatchlist(currentFeatured.id)}
                  className="btn-ghost flex items-center gap-2"
                  data-testid="add-to-list-btn"
                >
                  <Plus size={20} />
                  Ma Liste
                </button>
              </div>
            </motion.div>
          </div>

          {/* Slide Indicators */}
          <div className="absolute bottom-8 right-8 flex gap-2">
            {featured.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide ? 'w-8 bg-purple-500' : 'bg-zinc-600'
                }`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trending Section */}
      <section className="px-6 md:px-12 lg:px-16 py-12 max-w-7xl mx-auto" data-testid="trending-section">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Tendances</h2>
          <Link to="/browse" className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors">
            Voir tout <ChevronRight size={20} />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {trending.map((anime, index) => (
            <motion.div
              key={anime.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <AnimeCard anime={anime} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Recent Section */}
      <section className="px-6 md:px-12 lg:px-16 py-12 max-w-7xl mx-auto" data-testid="recent-section">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Ajouts Récents</h2>
          <Link to="/browse" className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors">
            Voir tout <ChevronRight size={20} />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {recent.map((anime, index) => (
            <motion.div
              key={anime.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <AnimeCard anime={anime} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-6 md:px-12 lg:px-16 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold gradient-text">ANISTREAM</span>
          </div>
          <p className="text-zinc-500 text-sm">
            © 2025 AniStream. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
