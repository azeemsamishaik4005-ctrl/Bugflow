import React, { useState } from 'react';
import { Lock, Mail, User, ArrowRight, Sparkles } from 'lucide-react';

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        if (res.status >= 500) {
          throw new Error('Cannot connect to the server. Please ensure the backend server is running on port 5000.');
        }
        throw new Error(`Server returned invalid response (Status ${res.status}). Expected JSON.`);
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Authentication failed');
      }

      localStorage.setItem('bugflow_token', data.token);
      localStorage.setItem('bugflow_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Lighting Accents */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none'
      }} />

      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '40px 36px',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.15), 0 0 40px var(--primary-glow)'
      }}>
        {/* Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '16px',
            width: '100%',
            maxWidth: '220px',
            padding: '0'
          }}>
            <img 
              src="/logo-transparent.png" 
              alt="DefectX Logo" 
              style={{
                width: '100px',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                marginBottom: '10px'
              }}
            />
            <h1 style={{ 
              fontSize: '1.4rem', 
              fontWeight: '700', 
              color: 'var(--text-main)', 
              margin: '0 0 6px 0', 
              textAlign: 'center',
              letterSpacing: '-0.5px'
            }}>
              DefectX
            </h1>
            <p style={{ 
              fontSize: '11px', 
              color: 'var(--text-muted)', 
              textAlign: 'center', 
              margin: '0', 
              lineHeight: '1.4',
              padding: '0 4px'
            }}>
              Intelligent Software<br />Defect Tracking System<br />with Resolution Assistant
            </p>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            {isLogin ? 'Sign in to access your issue tracking platform' : 'Create an account to manage bugs & features'}
          </p>
        </div>


        {error && (
          <div style={{
            background: 'var(--badge-p1-bg)',
            border: '1px solid var(--badge-p1-border)',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '20px',
            color: 'var(--badge-p1-text)',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '42px' }}
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                className="input-field"
                style={{ paddingLeft: '42px' }}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                className="input-field"
                style={{ paddingLeft: '42px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '14px',
              fontSize: '1rem'
            }}
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {isLogin ? "Don't have an account?" : 'Already registered?'}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-light)',
                fontWeight: 700,
                marginLeft: '8px',
                cursor: 'pointer'
              }}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
