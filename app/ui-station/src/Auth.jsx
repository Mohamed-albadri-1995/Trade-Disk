import React, { useState } from 'react';
import { supabase } from './supabase.js';

// The login / sign-up screen shown when no one is signed in. Email + password via
// Supabase Auth. Sign-up sends a confirmation email (then sign in). One account
// here unlocks the Station and every tool, since they share the session.

const S = {
  wrap: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% -20%,#102c43 0,#071421 55%,#050f1a 100%)' },
  card: { width: '100%', maxWidth: '400px', background: 'linear-gradient(150deg,#0b1e2e,#081624 85%)', border: '1px solid #1c3b51', borderRadius: '16px', padding: '30px 28px', boxShadow: '0 24px 60px rgba(0,0,0,.45)' },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', fontWeight: 850, fontSize: '20px', letterSpacing: '-.4px', color: '#eaf2f9' },
  mark: { display: 'grid', placeItems: 'center', width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(145deg,#1c9bff,#0562e6)', color: '#fff', fontSize: '16px' },
  sub: { color: '#9fb4c6', fontSize: '13px', margin: '0 0 20px' },
  label: { display: 'block', fontSize: '11px', letterSpacing: '.3px', color: '#9fb4c6', margin: '12px 0 6px', textTransform: 'uppercase' },
  input: { width: '100%', background: '#071725', border: '1px solid #1a3b53', borderRadius: '9px', padding: '11px 12px', color: '#eaf2f9', fontSize: '14px', boxSizing: 'border-box' },
  btn: { width: '100%', marginTop: '18px', border: 0, borderRadius: '10px', background: 'linear-gradient(180deg,#1683ff,#0864dc)', color: '#fff', padding: '12px', fontWeight: 750, fontSize: '14px', cursor: 'pointer' },
  toggle: { background: 'transparent', border: 0, color: '#58b0ff', cursor: 'pointer', fontSize: '13px', fontWeight: 650 },
  foot: { marginTop: '16px', textAlign: 'center', color: '#9fb4c6', fontSize: '13px' },
  err: { background: '#261823', border: '1px solid #673c4a', color: '#ff9ca8', padding: '9px 11px', borderRadius: '9px', fontSize: '12px', marginTop: '14px' },
  ok: { background: '#0c2e25', border: '1px solid #1c594b', color: '#7ef0c2', padding: '9px 11px', borderRadius: '9px', fontSize: '12px', marginTop: '14px' },
};

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!email || !pw) { setErr('Enter your email and password.'); return; }
    if (mode === 'signup' && pw.length < 8) { setErr('Use at least 8 characters for your password.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw error;
        setMsg('Account created — check your email to confirm, then sign in.');
        setMode('login'); setPw('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
        // success: onAuthStateChange flips the gate to the app
      }
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.brand}><span style={S.mark}>◆</span><span>Trade-Disk</span></div>
        <p style={S.sub}>{mode === 'login' ? 'Sign in to your trading station.' : 'Create your account to get started.'}</p>
        <form onSubmit={submit}>
          <label style={S.label} htmlFor="email">Email</label>
          <input style={S.input} id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          <label style={S.label} htmlFor="pw">Password</label>
          <input style={S.input} id="pw" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
          {err ? <div style={S.err}>{err}</div> : null}
          {msg ? <div style={S.ok}>{msg}</div> : null}
          <button style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div style={S.foot}>
          {mode === 'login' ? "No account yet? " : 'Already have an account? '}
          <button style={S.toggle} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr(''); setMsg(''); }}>
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
