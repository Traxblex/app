import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, X } from 'lucide-react';
import { animeApi } from '../api';
import AnimeCard from '../components/AnimeCard';
import Navbar from '../components/Navbar';

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [anime, setAnime] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get('genre') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');
  const [showFilters, setShowFilters] = useState(false);

  const statuses = ['ongoing', 'completed'];

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const res = await animeApi.getGenres();
        setGenres(res.data);
      } catch (error) {
        console.error('Error fetching genres:', error);
      }
    };
    fetchGenres();
  }, []);

  useEffect(() => {
    const fetchAnime = async () => {
      setLoading(true);
      try {
        const params = { page, limit: 20 };
        if (searchQuery) params.search = searchQuery;
        if (selectedGenre) params.genre = selectedGenre;
        if (selectedStatus) params.status = selectedStatus;

        const res = await animeApi.getList(params);
        setAnime(res.data.data);
        setTotalPages(res.data.pages);
      } catch (error) {
        console.error('Error fetching anime:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnime();
  }, [page, searchQuery, selectedGenre, selectedStatus]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    const newParams = new URLSearchParams();
    if (searchQuery) newParams.set('search', searchQuery);
    if (selectedGenre) newParams.set('genre', selectedGenre);
    if (selectedStatus) newParams.set('status', selectedStatus);
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGenre('');
    setSelectedStatus('');
    setPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || selectedGenre || selectedStatus;

  return (
    <div className="min-h-screen bg-[#050505]" data-testid="browse-page">
      <Navbar />

      <div className="pt-24 px-6 md:px-12 lg:px-16 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Parcourir</h1>
          <p className="text-zinc-400">Découvrez notre catalogue d'anime</p>
        </div>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un anime..."
                className="input-dark w-full pl-12"
                data-testid="search-input"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-ghost flex items-center gap-2 ${showFilters ? 'bg-purple-500/20' : ''}`}
              data-testid="filter-btn"
            >
              <Filter size={20} />
              Filtres
            </button>
            <button type="submit" className="btn-primary" data-testid="search-btn">
              Rechercher
            </button>
          </form>

          {/* Filter Panel */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass rounded-xl p-6 space-y-4"
            >
              {/* Genres */}
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => {
                        setSelectedGenre(selectedGenre === genre ? '' : genre);
                        setPage(1);
                      }}
                      className={`filter-chip ${selectedGenre === genre ? 'active' : ''}`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Statut</h3>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setSelectedStatus(selectedStatus === status ? '' : status);
                        setPage(1);
                      }}
                      className={`filter-chip ${selectedStatus === status ? 'active' : ''}`}
                    >
                      {status === 'ongoing' ? 'En cours' : 'Terminé'}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
                >
                  <X size={16} />
                  Effacer les filtres
                </button>
              )}
            </motion.div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl skeleton"></div>
            ))}
          </div>
        ) : anime.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg">Aucun anime trouvé</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" data-testid="anime-grid">
              {anime.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <AnimeCard anime={item} />
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-12 pb-12">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-ghost disabled:opacity-50"
                >
                  Précédent
                </button>
                <span className="flex items-center px-4 text-zinc-400">
                  Page {page} sur {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="btn-ghost disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
