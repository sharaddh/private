import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { Eye, EyeOff, Lock, ShieldCheck, UserPlus, CheckCircle2 } from 'lucide-react';

const SETUP_PASSWORD = '123123';

export default function OwnerSetup() {
  const [unlocked, setUnlocked] = useState(false);
  const [gatePassword, setGatePassword] = useState('');
  const [gateError, setGateError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const navigate = useNavigate();

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (gatePassword === SETUP_PASSWORD) {
      setUnlocked(true);
      setGateError('');
      return;
    }
    setGateError('Incorrect setup password');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/register-owner', {
        username: username.trim(),
        password,
        name: name.trim(),
        mobile: mobile.trim(),
      });
      if (res.success) {
        setCreated(true);
      } else {
        setError(res.message || 'Could not create owner');
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-th-base flex items-center justify-center p-4"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#1ed760] rounded-sm flex items-center justify-center mx-auto mb-4">
            <span className="text-black font-bold text-xl">K</span>
          </div>
          <h1 className="text-2xl font-bold text-th-text tracking-tight">KMJ Optical</h1>
          <p className="text-sm text-th-secondary mt-1 font-normal">Owner Setup</p>
        </div>

        <div className="bg-th-surface rounded-lg p-6 shadow-2xl">
          {created ? (
            <div className="text-center space-y-4">
              <CheckCircle2 size={40} className="text-[#1ed760] mx-auto" />
              <h2 className="text-lg font-bold text-th-text">Owner account created</h2>
              <p className="text-sm text-th-secondary">
                You can now sign in with <span className="text-th-text font-medium">{username}</span>.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full py-3 bg-[#1ed760] text-black rounded-[9999px] text-sm font-bold uppercase tracking-wider active:scale-95 transition-transform"
              >
                Go to login
              </button>
            </div>
          ) : !unlocked ? (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-th-secondary">
                <Lock size={16} />
                Enter setup password to continue
              </div>
              {gateError && (
                <div className="bg-[#3d1515] border border-[#b91c1c] text-[#f87171] px-4 py-3 rounded-lg text-sm">
                  {gateError}
                </div>
              )}
              <input
                type="password"
                value={gatePassword}
                onChange={(e) => setGatePassword(e.target.value)}
                placeholder="Setup password"
                required
                autoFocus
                className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all"
              />
              <button
                type="submit"
                className="w-full py-3 bg-[#1ed760] text-black rounded-[9999px] text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <ShieldCheck size={18} />
                Unlock
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-[#3d1515] border border-[#b91c1c] text-[#f87171] px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Owner username"
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Owner name"
                  className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">
                  Mobile
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Mobile number"
                  className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-th-secondary hover:text-th-text transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">
                  Confirm password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full px-3 py-2.5 bg-th-elevated rounded text-sm text-th-text placeholder-th-muted focus:outline-none ring-inset ring-1 ring-th-border-strong focus:ring-1 focus:ring-[#1ed760] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#1ed760] text-black rounded-[9999px] text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-2 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Create owner
                  </>
                )}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-th-secondary mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-[#1ed760] hover:underline font-medium">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
