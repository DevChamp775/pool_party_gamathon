import { useCallback, useEffect, useState } from 'react';
import { AdminPortal } from './components/AdminPortal.tsx';
import type { AdminRoute } from './components/AdminPortal.tsx';
import { PlayerPortal } from './components/PlayerPortal.tsx';
import type { PlayerRoute } from './components/PlayerPortal.tsx';
import { useWebSocketChannel } from './hooks/useWebSocketState.ts';
import { adminApi, playerApi, publicApi } from './utils/api.ts';
import { arcadeSfx } from './utils/sound.ts';
import type { AdminSessionState, PlayerSessionState, PublicGameState } from './types/game.ts';

function normalizePath(pathname: string): string {
  if (pathname === '/team') return '/play';
  return pathname.replace(/\/+$/, '') || '/';
}

export default function App() {
  const [path, setPath] = useState<string>(() => normalizePath(window.location.pathname));
  const [bootstrapped, setBootstrapped] = useState(false);

  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerSessionState | null>(null);
  const [adminState, setAdminState] = useState<AdminSessionState | null>(null);

  const navigate = useCallback((to: string) => {
    const clean = normalizePath(to);
    if (window.location.pathname !== clean) {
      window.history.pushState({}, '', clean);
    }
    setPath(clean);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Initial session hydration
  useEffect(() => {
    let active = true;
    Promise.all([
      publicApi.getState().catch(() => null),
      playerApi.me().catch(() => ({ authenticated: false })),
      adminApi.me().catch(() => ({ authenticated: false })),
    ]).then(([pub, ply, adm]) => {
      if (!active) return;
      if (pub) setPublicState(pub);
      if (ply && 'state' in ply && ply.authenticated && ply.state) {
        setPlayerState(ply.state);
      }
      if (adm && 'state' in adm && adm.authenticated && adm.state) {
        setAdminState(adm.state);
      }
      setBootstrapped(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const isAdminRoute = path.startsWith('/admin');

  // Role-isolated WebSocket channels
  const adminWs = useWebSocketChannel<AdminSessionState>(
    'admin',
    bootstrapped && isAdminRoute && Boolean(adminState)
  );
  const teamWs = useWebSocketChannel<PlayerSessionState>(
    'team',
    bootstrapped && !isAdminRoute && Boolean(playerState),
    (eventName) => {
      if (eventName === 'round_revealed') {
        arcadeSfx.playSplashReveal();
      }
    }
  );
  const displayWs = useWebSocketChannel<PublicGameState>(
    'display',
    bootstrapped && (!isAdminRoute && !playerState),
    (eventName) => {
      if (eventName === 'round_revealed') {
        arcadeSfx.playSplashReveal();
      }
    }
  );

  useEffect(() => {
    if (adminWs.state) setAdminState(adminWs.state);
  }, [adminWs.state]);

  useEffect(() => {
    if (teamWs.state) {
      setPlayerState(teamWs.state);
      setPublicState(teamWs.state);
    }
  }, [teamWs.state]);

  useEffect(() => {
    if (displayWs.state) setPublicState(displayWs.state);
  }, [displayWs.state]);

  useEffect(() => {
    if (teamWs.sessionResetFlag) {
      setPlayerState(null);
      navigate('/join');
    }
  }, [teamWs.sessionResetFlag, navigate]);

  const handlePlayerLogout = async () => {
    await playerApi.logout().catch(() => {});
    setPlayerState(null);
    navigate('/');
  };

  const handleAdminLogout = async () => {
    await adminApi.logout().catch(() => {});
    setAdminState(null);
    navigate('/admin/login');
  };

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#091017] text-amber-300 font-pixel text-sm">
        LOADING POOL PARTY...
      </div>
    );
  }

  if (isAdminRoute) {
    const adminRoute: AdminRoute =
      path === '/admin/setup'
        ? '/admin/setup'
        : path === '/admin/login'
        ? '/admin/login'
        : '/admin';

    return (
      <AdminPortal
        route={adminRoute}
        navigate={navigate}
        adminState={adminState}
        wsConnected={adminWs.connected}
        onAdminAuthenticated={(st) => setAdminState(st)}
        onAdminLogout={handleAdminLogout}
      />
    );
  }

  const playerRoute: PlayerRoute =
    path === '/join' ||
    path === '/play' ||
    path === '/leaderboard' ||
    path === '/results' ||
    path === '/display'
      ? (path as PlayerRoute)
      : '/';

  return (
    <PlayerPortal
      route={playerRoute}
      navigate={navigate}
      playerState={playerState}
      publicState={publicState}
      wsConnected={playerState ? teamWs.connected : displayWs.connected}
      onPlayerAuthenticated={(st) => {
        setPlayerState(st);
        setPublicState(st);
      }}
      onPlayerLogout={handlePlayerLogout}
    />
  );
}
