import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LogOut, Github, User, RefreshCcw } from 'lucide-react';
import './AccountMenu.css';

const GITHUB_CLIENT_ID = 'Ov23liWNwWqM9SO0J9nF';
const REDIRECT_URI = 'http://localhost:1420';
const PROXY_SERVER = 'http://localhost:3000/auth';

interface AccountMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onLoginChange?: (login: string | null) => void;
}

const AccountMenu: React.FC<AccountMenuProps> = ({ isVisible, onClose, onLoginChange }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userLogin, setUserLogin] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [authState] = useState(() => Math.random().toString(36).substring(7));
  const [loading, setLoading] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user_login');
    localStorage.removeItem('github_user_avatar');
    localStorage.removeItem('github_auth_state');
    setAccessToken(null);
    setUserLogin(null);
    setUserAvatar(null);
    onLoginChange?.(null);
    onClose();
    
    // Отправляем событие для обновления состояния репозиториев
    document.dispatchEvent(new CustomEvent('auth-changed'));
  }, [onClose, onLoginChange]);

  const exchangeCodeForToken = useCallback(async (code: string) => {
    try {
      setLoading(true);
      const response = await fetch(PROXY_SERVER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, client_id: GITHUB_CLIENT_ID, redirect_uri: REDIRECT_URI }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const { access_token } = await response.json();
      return access_token;
    } catch (error) {
      console.error('Token exchange error:', error);
      handleLogout();
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleLogout]);

  const checkAuth = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      console.error('GitHub auth error:', error);
      handleLogout();
      return;
    }

    if (code && state === localStorage.getItem('github_auth_state')) {
      const token = await exchangeCodeForToken(code);
      if (!token) return;

      try {
        setLoading(true);
        const userResponse = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userData = await userResponse.json();
        
        localStorage.setItem('github_token', token);
        localStorage.setItem('github_user_login', userData.login);
        localStorage.setItem('github_user_avatar', userData.avatar_url);
        setAccessToken(token);
        setUserLogin(userData.login);
        setUserAvatar(userData.avatar_url);
        onLoginChange?.(userData.login);
        
        // Отправляем событие для обновления состояния репозиториев
        document.dispatchEvent(new CustomEvent('auth-changed'));
        
        window.history.replaceState({}, '', window.location.pathname);
      } catch (error) {
        console.error('User fetch error:', error);
        handleLogout();
      } finally {
        setLoading(false);
      }
    }
  }, [exchangeCodeForToken, handleLogout, onLoginChange]);

  useEffect(() => {
    checkAuth();
    const handleHashChange = () => checkAuth();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [checkAuth]);

  useEffect(() => {
    const token = localStorage.getItem('github_token');
    const login = localStorage.getItem('github_user_login');
    const avatar = localStorage.getItem('github_user_avatar');
    if (token && login && avatar) {
      setAccessToken(token);
      setUserLogin(login);
      setUserAvatar(avatar);
      onLoginChange?.(login);
    }
  }, [onLoginChange]);

  const handleGitHubLogin = () => {
    localStorage.setItem('github_auth_state', authState);
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'user:email,repo',
      state: authState,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  };

  const handleRefresh = () => {
    checkAuth();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="leftbar-account-overlay">
      <div className="leftbar-account-menu" ref={menuRef}>
        <div className="leftbar-account-header">
          <h3>Аккаунт</h3>
          <button 
            className="refresh-button" 
            onClick={handleRefresh}
            title="Обновить информацию"
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? 'spinning' : ''} />
          </button>
        </div>
        <div className="leftbar-account-content">
          {!accessToken ? (
            <div 
              className="leftbar-account-item github-login" 
              onClick={() => { handleGitHubLogin(); onClose(); }}
            >
              <span>Войти через GitHub</span>
              <Github size={16} />
            </div>
          ) : (
            <>
              <div className="leftbar-account-user">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt="User avatar"
                    className="user-avatar"
                  />
                ) : (
                  <User size={16} className="user-avatar" />
                )}
                <span>{userLogin}</span>
              </div>
              <div className="leftbar-account-divider"></div>
              <div 
                className="leftbar-account-item logout" 
                onClick={handleLogout}
              >
                <span>Выйти</span>
                <LogOut size={16} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountMenu;