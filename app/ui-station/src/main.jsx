import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import Auth from './Auth.jsx';
import { useSession, ensureProfile, signOut } from './auth.js';

// The gate: show the login screen until someone is signed in, then the Station.
// One session is shared across every Trade-Disk app (same origin).
function Root() {
  const { session, loading } = useSession();
  useEffect(() => { if (session?.user) ensureProfile(session.user); }, [session?.user?.id]);
  if (loading) return null;
  if (!session) return <Auth />;
  return <App session={session} onSignOut={signOut} />;
}

createRoot(document.getElementById('root')).render(<Root />);
