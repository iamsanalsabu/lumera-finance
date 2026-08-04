"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
      <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: '50%', border: '1px solid var(--border-light)' }}>
            <Lock size={32} color="var(--accent-primary)" />
          </div>
        </div>
        
        <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>Lumera Finance</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Enter your vault key to continue</p>

        <form onSubmit={handleLogin}>
          <div className="input-group" style={{ marginBottom: '24px' }}>
            <input 
              type="password" 
              className="input-field" 
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ textAlign: 'center', letterSpacing: '0.2em' }}
            />
          </div>
          
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '16px' }}>{error}</p>}

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%' }}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : (
              <>
                Unlock Vault <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
