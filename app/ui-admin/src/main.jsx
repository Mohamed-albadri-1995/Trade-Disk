import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { useGate } from './auth.js';

// Gate the admin dashboard behind the shared login: signed-out visitors are sent
// to the Station to sign in; signed-in ones get the app (its API calls carry the
// token, and the server's RLS lets only an owner/admin write the feed config).
function Root() {
  const ready = useGate();
  if (!ready) return null;
  return <App />;
}

createRoot(document.getElementById('root')).render(<Root />);
