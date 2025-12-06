import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Heart, List, Clock, LogOut, Settings } from 'lucide-react';
import { userApi } from '../api';
import { useAuth } from '../context/AuthContext';
import AnimeCard from '../components/AnimeCard';
import Navbar from '../components/Navbar';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('watchlist');
  const [watchlist, setWatchlist] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [watchlistRes, favoritesRes, historyRes] = await Promise.all([
          userApi.getWatchlist(user.user_id),
          userApi.getFavorites(user.user_id),
          userApi.getHistory(user.user_id),
        ]);
        setWatchlist(watchlistRes.data);
        setFavorites(favoritesRes.data);
        setHistory(historyRes.data);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const tabs = [
    { id: 'watchlist', label: 'Ma Liste', icon: List, count: watchlist.length },
    { id: 'favorites', label: 'Favoris', icon: Heart, count: favorites.length },
    { id: 'history', label: 'Historique', icon: Clock, count: history.length },
  ];

  const getActiveContent = () => {
    switch (activeTab) {
      case 'watchlist':
        return watchlist;
      case 'favorites':
        return favorites;
      case 'history':
        return history.map(h => h.anime).filter(Boolean);
      default:
        return [];
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#050505]" data-testid="profile-page">
      <Navbar />

      <div className="pt-24 px-6 md:px-12 lg:px-16 max-w-7xl mx-auto">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 mb-8"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-500">
              {user.avatar ? (
                <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-purple-500/20 flex items-center justify-center">
                  <User size={40} className="text-purple-400" />
                </div>
              )}
            </div>
            <div className="text-center md:text-left flex-1">
              <h1 className="text-2xl font-bold mb-1" data-testid="username">{user.username}</h1>
              {user.email && <p className="text-zinc-400">{user.email}</p>}
            </div>
            <button
              onClick={handleLogout}
              className="btn-ghost flex items-center gap-2 text-red-400 border-red-400/30 hover:bg-red-500/10"
              data-testid="logout-btn"
            >
              <LogOut size={20} />
              Déconnexion
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon size={20} />
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-zinc-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl skeleton"></div>
            ))}
          </div>
        ) : getActiveContent().length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg mb-4">
              {activeTab === 'watchlist' && 'Votre liste est vide'}
              {activeTab === 'favorites' && 'Aucun favori'}
              {activeTab === 'history' && 'Aucun historique'}
            </p>
            <Link to="/browse" className="btn-primary">
              Découvrir des anime
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-12">
            {getActiveContent().map((anime, index) => (
              <motion.div
                key={anime.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <AnimeCard anime={anime} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
