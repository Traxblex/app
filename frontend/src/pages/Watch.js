import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactPlayer from 'react-player';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, SkipForward, 
  ChevronLeft, ChevronRight, Settings, List 
} from 'lucide-react';
import { animeApi, userApi } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Watch() {
  const { animeId, episodeNumber } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const playerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const [anime, setAnime] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentEpisodeNum = parseInt(episodeNumber);

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const res = await animeApi.getById(animeId);
        setAnime(res.data);
        const episode = res.data.episodes?.find(e => e.number === currentEpisodeNum);
        setCurrentEpisode(episode);
      } catch (error) {
        console.error('Error fetching anime:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnime();
  }, [animeId, currentEpisodeNum]);

  useEffect(() => {
    // Update watch history
    if (user && anime && currentEpisode) {
      userApi.updateHistory(user.user_id, animeId, currentEpisodeNum, progress).catch(console.error);
    }
  }, [user, anime, currentEpisode, animeId, currentEpisodeNum, progress]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleProgress = (state) => {
    setProgress(state.played * 100);
  };

  const handleDuration = (dur) => {
    setDuration(dur);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    playerRef.current?.seekTo(percent);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const goToEpisode = (num) => {
    navigate(`/watch/${animeId}/${num}`);
    setShowEpisodeList(false);
  };

  const hasNextEpisode = anime?.episodes?.some(e => e.number === currentEpisodeNum + 1);
  const hasPrevEpisode = anime?.episodes?.some(e => e.number === currentEpisodeNum - 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!anime || !currentEpisode) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-400">Épisode non trouvé</p>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-black flex flex-col" 
      onMouseMove={handleMouseMove}
      data-testid="watch-page"
    >
      {/* Video Player Container */}
      <div className="relative flex-1 flex items-center justify-center">
        <ReactPlayer
          ref={playerRef}
          url={currentEpisode.video_url}
          width="100%"
          height="100%"
          playing={playing}
          volume={volume}
          muted={muted}
          onProgress={handleProgress}
          onDuration={handleDuration}
          style={{ position: 'absolute', top: 0, left: 0 }}
          config={{
            file: {
              attributes: {
                style: { width: '100%', height: '100%', objectFit: 'contain' }
              }
            }
          }}
        />

        {/* Controls Overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between"
            >
              {/* Top Bar */}
              <div className="p-4 flex items-center justify-between">
                <Link 
                  to={`/anime/${animeId}`}
                  className="flex items-center gap-2 text-white hover:text-purple-400 transition-colors"
                >
                  <ChevronLeft size={24} />
                  <span className="font-medium">Retour</span>
                </Link>
                <div className="text-center">
                  <p className="text-zinc-400 text-sm">{anime.title}</p>
                  <p className="text-white font-medium">EP {currentEpisodeNum} - {currentEpisode.title}</p>
                </div>
                <button
                  onClick={() => setShowEpisodeList(!showEpisodeList)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <List size={24} />
                </button>
              </div>

              {/* Center Play Button */}
              <button
                onClick={() => setPlaying(!playing)}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-purple-500/80 flex items-center justify-center hover:bg-purple-500 transition-colors"
                data-testid="play-pause-btn"
              >
                {playing ? <Pause size={40} /> : <Play size={40} fill="white" />}
              </button>

              {/* Bottom Controls */}
              <div className="p-4 space-y-3">
                {/* Progress Bar */}
                <div 
                  className="h-1 bg-zinc-700 rounded-full cursor-pointer group"
                  onClick={handleSeek}
                >
                  <div 
                    className="h-full bg-purple-500 rounded-full relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setPlaying(!playing)}
                      className="hover:text-purple-400 transition-colors"
                    >
                      {playing ? <Pause size={24} /> : <Play size={24} />}
                    </button>

                    {hasPrevEpisode && (
                      <button
                        onClick={() => goToEpisode(currentEpisodeNum - 1)}
                        className="hover:text-purple-400 transition-colors"
                      >
                        <ChevronLeft size={24} />
                      </button>
                    )}

                    {hasNextEpisode && (
                      <button
                        onClick={() => goToEpisode(currentEpisodeNum + 1)}
                        className="hover:text-purple-400 transition-colors flex items-center gap-1"
                        data-testid="next-episode-btn"
                      >
                        <SkipForward size={24} />
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMuted(!muted)}
                        className="hover:text-purple-400 transition-colors"
                      >
                        {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={muted ? 0 : volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-20 accent-purple-500"
                      />
                    </div>

                    <span className="text-sm text-zinc-400 font-mono">
                      {formatTime((progress / 100) * duration)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <button className="hover:text-purple-400 transition-colors">
                      <Settings size={24} />
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className="hover:text-purple-400 transition-colors"
                    >
                      <Maximize size={24} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Episode List Sidebar */}
        <AnimatePresence>
          {showEpisodeList && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-black/90 backdrop-blur-xl border-l border-zinc-800 overflow-y-auto"
            >
              <div className="p-4">
                <h3 className="text-lg font-bold mb-4">Épisodes</h3>
                <div className="space-y-2">
                  {anime.episodes?.map((ep) => (
                    <button
                      key={ep.number}
                      onClick={() => goToEpisode(ep.number)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        ep.number === currentEpisodeNum 
                          ? 'bg-purple-500/20 border border-purple-500' 
                          : 'hover:bg-zinc-800'
                      }`}
                    >
                      <span className="font-mono text-purple-400">EP {ep.number}</span>
                      <p className="text-sm truncate">{ep.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Next Episode Banner */}
      {hasNextEpisode && progress > 90 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-24 right-4 glass rounded-xl p-4"
        >
          <p className="text-sm text-zinc-400 mb-2">Épisode suivant</p>
          <button
            onClick={() => goToEpisode(currentEpisodeNum + 1)}
            className="btn-primary flex items-center gap-2"
          >
            <SkipForward size={20} />
            Épisode {currentEpisodeNum + 1}
          </button>
        </motion.div>
      )}
    </div>
  );
}
