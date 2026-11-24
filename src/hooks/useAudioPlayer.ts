import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppSettings, RepeatMode, Track } from '../types';

interface UseAudioPlayerOptions {
  tracks: Track[];
  settings: AppSettings;
  onTrackUpdated: (track: Track) => void;
  onSettingsUpdated: (patch: Partial<AppSettings>) => void;
}

function shuffleWithCurrentFirst(list: Track[], firstId: string): Track[] {
  const first = list.find((t) => t.id === firstId);
  const rest = list.filter((t) => t.id !== firstId);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first ? [first, ...rest] : rest;
}

export function useAudioPlayer({
  tracks,
  settings,
  onTrackUpdated,
  onSettingsUpdated,
}: UseAudioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current) {
    const el = new Audio();
    el.preload = 'metadata';
    audioRef.current = el;
  }

  const [queue, setQueue] = useState<Track[]>([]);
  const [originalQueue, setOriginalQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(settings.volume);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [shuffle, setShuffleState] = useState(settings.shuffle);
  const [repeat, setRepeatState] = useState<RepeatMode>(settings.repeat);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const rawCurrentTrack = queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null;
  const currentTrack = rawCurrentTrack ? trackMap.get(rawCurrentTrack.id) ?? rawCurrentTrack : null;

  // Refs for latest state inside event listeners
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const queueIndexRef = useRef(queueIndex);
  queueIndexRef.current = queueIndex;
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastSavedTimeRef = useRef<{ id: string; time: number }>({ id: '', time: -1 });
  const pendingResumeTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setVolumeState(settings.volume);
    setShuffleState(settings.shuffle);
    setRepeatState(settings.repeat);
  }, [settings.volume, settings.shuffle, settings.repeat]);

  // Keep queue entries fresh when library tracks update (e.g. liked, metadata edits)
  useEffect(() => {
    setQueue((prev) =>
      prev
        .map((item) => trackMap.get(item.id) ?? item)
        .filter((item) => trackMap.size === 0 || trackMap.has(item.id)),
    );
    setOriginalQueue((prev) =>
      prev
        .map((item) => trackMap.get(item.id) ?? item)
        .filter((item) => trackMap.size === 0 || trackMap.has(item.id)),
    );
  }, [trackMap]);

  const persistPosition = useCallback(
    (track: Track | null, pos: number, forceZero = false) => {
      if (!track || !window.localify) return;
      const trackDur = track.duration || audioRef.current?.duration || 0;
      const normalized =
        forceZero || (trackDur > 0 && pos >= trackDur - 15) ? 0 : Math.max(0, Math.floor(pos));

      if (
        lastSavedTimeRef.current.id === track.id &&
        Math.abs(lastSavedTimeRef.current.time - normalized) < 2 &&
        !forceZero
      ) {
        return;
      }

      lastSavedTimeRef.current = { id: track.id, time: normalized };
      void window.localify.library
        .updateTrack(track.id, { lastPosition: normalized })
        .then((updated) => {
          if (updated) onTrackUpdated(updated);
        })
        .catch(() => {
          // ignore
        });
    },
    [onTrackUpdated],
  );

  const loadAndPlayAtIndex = useCallback(
    (nextQueue: Track[], index: number, explicitStartAt?: number) => {
      const audio = audioRef.current;
      const target = nextQueue[index];
      if (!audio || !target || !target.audioUrl) return;

      const outgoing = currentTrackRef.current;
      if (outgoing && outgoing.id !== target.id) {
        persistPosition(outgoing, audio.currentTime);
      }

      setPlayError(null);
      setResumedFrom(null);

      const threshold = settingsRef.current.resumeThresholdSeconds;
      const shouldAutoResume =
        explicitStartAt === undefined &&
        target.duration >= threshold &&
        target.lastPosition > 5 &&
        target.lastPosition < target.duration - 15;

      const resumeTarget =
        explicitStartAt !== undefined
          ? explicitStartAt
          : shouldAutoResume
            ? target.lastPosition
            : null;

      pendingResumeTimeRef.current = resumeTarget;

      setQueueIndex(index);
      setCurrentTime(resumeTarget ?? 0);
      setDuration(target.duration || 0);

      audio.src = target.audioUrl;
      audio.playbackRate = playbackRate;
      audio.load();

      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setIsPlaying(false);
          setPlayError('Gagal memutar file audio.');
        });

      if (window.localify) {
        void window.localify.library
          .updateTrack(target.id, {
            playCount: (target.playCount || 0) + 1,
            lastPlayedAt: Date.now(),
          })
          .then((updated) => {
            if (updated) onTrackUpdated(updated);
          })
          .catch(() => {
            // ignore
          });
      }
    },
    [onTrackUpdated, persistPosition, playbackRate],
  );

  const playTrack = useCallback(
    (track: Track, contextList?: Track[], startAtSeconds?: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (currentTrackRef.current?.id === track.id && startAtSeconds === undefined) {
        if (audio.paused) {
          audio
            .play()
            .then(() => setIsPlaying(true))
            .catch((err: unknown) => {
              if (err instanceof DOMException && err.name === 'AbortError') return;
              setIsPlaying(false);
            });
        } else {
          audio.pause();
          setIsPlaying(false);
          persistPosition(track, audio.currentTime);
        }
        return;
      }

      const baseList = contextList && contextList.length > 0 ? [...contextList] : [track];
      const nextQueue = shuffle ? shuffleWithCurrentFirst(baseList, track.id) : baseList;
      const nextIndex = Math.max(
        0,
        nextQueue.findIndex((t) => t.id === track.id),
      );

      setOriginalQueue(baseList);
      setQueue(nextQueue);
      loadAndPlayAtIndex(nextQueue, nextIndex, startAtSeconds);
    },
    [loadAndPlayAtIndex, persistPosition, shuffle],
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrackRef.current) {
      if (tracks.length > 0) {
        playTrack(tracks[0], tracks);
      }
      return;
    }

    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setIsPlaying(false);
        });
    } else {
      audio.pause();
      setIsPlaying(false);
      persistPosition(currentTrackRef.current, audio.currentTime);
    }
  }, [persistPosition, playTrack, tracks]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || !currentTrackRef.current) return;
      const maxDur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : currentTrackRef.current.duration;
      const clamped = Math.max(0, Math.min(seconds, maxDur || seconds));
      audio.currentTime = clamped;
      setCurrentTime(clamped);
      if (clamped <= 2) {
        setResumedFrom(null);
      }
    },
    [],
  );

  const playNext = useCallback(
    (autoAdvance = false) => {
      const q = queueRef.current;
      const idx = queueIndexRef.current;
      const audio = audioRef.current;
      if (q.length === 0 || !audio) return;

      if (autoAdvance && repeatRef.current === 'one') {
        audio.currentTime = 0;
        setCurrentTime(0);
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
        return;
      }

      if (idx + 1 < q.length) {
        loadAndPlayAtIndex(q, idx + 1);
      } else if (repeatRef.current === 'all') {
        loadAndPlayAtIndex(q, 0);
      } else {
        audio.pause();
        setIsPlaying(false);
        persistPosition(currentTrackRef.current, audio.currentTime, autoAdvance);
      }
    },
    [loadAndPlayAtIndex, persistPosition],
  );

  const playPrev = useCallback(() => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const audio = audioRef.current;
    if (q.length === 0 || !audio) return;

    if (audio.currentTime > 3) {
      seek(0);
      return;
    }

    if (idx > 0) {
      loadAndPlayAtIndex(q, idx - 1);
    } else if (repeatRef.current === 'all') {
      loadAndPlayAtIndex(q, q.length - 1);
    } else {
      seek(0);
    }
  }, [loadAndPlayAtIndex, seek]);

  const setVolume = useCallback(
    (val: number) => {
      const clamped = Math.max(0, Math.min(1, val));
      setVolumeState(clamped);
      if (clamped > 0 && muted) {
        setMuted(false);
      }
      if (audioRef.current) {
        audioRef.current.volume = clamped;
        audioRef.current.muted = clamped === 0;
      }
      onSettingsUpdated({ volume: clamped });
    },
    [muted, onSettingsUpdated],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleState((prev) => {
      const next = !prev;
      onSettingsUpdated({ shuffle: next });

      const active = currentTrackRef.current;
      if (queueRef.current.length > 1 && active) {
        if (next) {
          const nextQ = shuffleWithCurrentFirst(queueRef.current, active.id);
          setQueue(nextQ);
          setQueueIndex(0);
        } else if (originalQueue.length > 0) {
          const restoredIdx = Math.max(
            0,
            originalQueue.findIndex((t) => t.id === active.id),
          );
          setQueue([...originalQueue]);
          setQueueIndex(restoredIdx);
        }
      }
      return next;
    });
  }, [onSettingsUpdated, originalQueue]);

  const cycleRepeat = useCallback(() => {
    setRepeatState((prev) => {
      const next: RepeatMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      onSettingsUpdated({ repeat: next });
      return next;
    });
  }, [onSettingsUpdated]);

  const addToQueue = useCallback(
    (track: Track) => {
      if (queueRef.current.length === 0) {
        playTrack(track, [track]);
        return;
      }
      const insertAt = Math.min(queueRef.current.length, queueIndexRef.current + 1);
      setQueue((prev) => {
        const copy = [...prev];
        copy.splice(insertAt, 0, track);
        return copy;
      });
      setOriginalQueue((prev) => [...prev, track]);
    },
    [playTrack],
  );

  const jumpToQueueIndex = useCallback(
    (index: number) => {
      const q = queueRef.current;
      if (index >= 0 && index < q.length) {
        loadAndPlayAtIndex(q, index);
      }
    },
    [loadAndPlayAtIndex],
  );

  const removeFromQueue = useCallback((index: number) => {
    if (index <= queueIndexRef.current || index >= queueRef.current.length) return;
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearUpNext = useCallback(() => {
    const idx = queueIndexRef.current;
    if (idx < 0) return;
    setQueue((prev) => prev.slice(0, idx + 1));
  }, []);

  // Sync volume/mute on audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // Attach core HTMLAudioElement listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (dur > 0) setDuration(dur);

      if (pendingResumeTimeRef.current !== null) {
        const targetPos = pendingResumeTimeRef.current;
        pendingResumeTimeRef.current = null;
        if (targetPos > 0 && (dur === 0 || targetPos < dur - 5)) {
          audio.currentTime = targetPos;
          setCurrentTime(targetPos);
          setResumedFrom(targetPos);
        }
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (currentTrackRef.current && !audio.paused) {
        persistPosition(currentTrackRef.current, audio.currentTime);
      }
    };

    const handleEnded = () => {
      persistPosition(currentTrackRef.current, audio.currentTime, true);
      playNext(true);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      setIsPlaying(false);
      setPlayError('Stream audio gagal dimuat.');
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    const handleBeforeUnload = () => {
      if (currentTrackRef.current) {
        persistPosition(currentTrackRef.current, audio.currentTime);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [persistPosition, playNext]);

  // Linux MediaSession API integration
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    if (currentTrack) {
      ms.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: currentTrack.coverUrl
          ? [{ src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      });
    } else {
      ms.metadata = null;
    }

    ms.playbackState = isPlaying ? 'playing' : currentTrack ? 'paused' : 'none';
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // unsupported action in environment
      }
    };

    safeSet('play', () => togglePlayPause());
    safeSet('pause', () => togglePlayPause());
    safeSet('previoustrack', () => playPrev());
    safeSet('nexttrack', () => playNext(false));
    safeSet('seekto', (details) => {
      if (typeof details.seekTime === 'number') seek(details.seekTime);
    });
    safeSet('seekbackward', (details) => {
      seek((audioRef.current?.currentTime || 0) - (details.seekOffset || 10));
    });
    safeSet('seekforward', (details) => {
      seek((audioRef.current?.currentTime || 0) + (details.seekOffset || 10));
    });
  }, [playNext, playPrev, seek, togglePlayPause]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seek((audioRef.current?.currentTime || 0) + (e.shiftKey ? 30 : 10));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seek((audioRef.current?.currentTime || 0) - (e.shiftKey ? 30 : 10));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume((audioRef.current?.volume ?? volume) + 0.05);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume((audioRef.current?.volume ?? volume) - 0.05);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [seek, setVolume, togglePlayPause, volume]);

  return {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    playbackRate,
    shuffle,
    repeat,
    resumedFrom,
    playError,
    playTrack,
    togglePlayPause,
    seek,
    playNext,
    playPrev,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleShuffle,
    cycleRepeat,
    addToQueue,
    jumpToQueueIndex,
    removeFromQueue,
    clearUpNext,
    dismissResumedBanner: () => setResumedFrom(null),
  };
}
