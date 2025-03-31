import React, { useRef, useEffect, useState } from 'react';
import { LogOut, Github } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog'; // Импортируем API для открытия браузера
import './AccountMenu.css';

const GITHUB_CLIENT_ID = 'Ov23liWNwWqM9SO0J9nF'; // Ваш Client ID

interface AccountMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onLoginChange?: (login: string | null) => void;
}

const AccountMenu: React.FC<AccountMenuProps> = ({ isVisible, onClose, onLoginChange }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userLogin, setUserLogin] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('github_token');
    const savedLogin = localStorage.getItem('github_user_login');

    console.log('Checking saved token and login...');
    console.log('Saved token:', savedToken);
    console.log('Saved login:', savedLogin);

    if (savedToken) {
      setAccessToken(savedToken);
      console.log('Access token set from saved:', savedToken);
      if (savedLogin) {
        setUserLogin(savedLogin);
        console.log('User login set from saved:', savedLogin);
        if (onLoginChange) {
          onLoginChange(savedLogin);
          console.log('onLoginChange called with saved login:', savedLogin);
        }
      } else {
        console.log('No saved login, fetching user data from GitHub API...');
        fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        })
          .then(res => res.json())
          .then(data => {
            console.log('GitHub API response:', data);
            if (data.login) {
              setUserLogin(data.login);
              localStorage.setItem('github_user_login', data.login);
              console.log('User login set from API:', data.login);
              if (onLoginChange) {
                onLoginChange(data.login);
                console.log('onLoginChange called with API login:', data.login);
              }
            } else {
              console.error('No login found in GitHub user data:', data);
              handleLogout();
            }
          })
          .catch(err => {
            console.error('Error fetching user data:', err);
            handleLogout();
          });
      }
    } else {
      console.log('No saved token found.');
    }

    // Проверка URL на наличие токена после редиректа
    const hash = window.location.hash;
    console.log('Checking URL hash for token:', hash);
    if (hash) {
      const tokenMatch = hash.match(/access_token=([^&]+)/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        setAccessToken(token);
        localStorage.setItem('github_token', token);
        console.log('Access token set from URL:', token);
        window.history.pushState("", document.title, window.location.pathname + window.location.search);

        console.log('Fetching user data with new token...');
        fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then(res => res.json())
          .then(data => {
            console.log('GitHub API response after redirect:', data);
            if (data.login) {
              setUserLogin(data.login);
              localStorage.setItem('github_user_login', data.login);
              console.log('User login set from API after redirect:', data.login);
              if (onLoginChange) {
                onLoginChange(data.login);
                console.log('onLoginChange called with API login after redirect:', data.login);
              }
            } else {
              console.error('No login found in GitHub user data after redirect:', data);
              handleLogout();
            }
          })
          .catch(err => {
            console.error('Error fetching user data after redirect:', err);
            handleLogout();
          });
      } else {
        console.log('No access token found in URL hash.');
      }
    } else {
      console.log('No hash in URL.');
    }
  }, [onLoginChange]);

  const handleGitHubLogin = async () => {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: 'http://localhost:3000', // Убедитесь, что это совпадает с настройками GitHub
      response_type: 'token',
      scope: 'user:email',
      state: Math.random().toString(36).substring(7),
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    console.log('Initiating GitHub login, opening browser:', authUrl);

    try {
      // Открываем URL в системном браузере
      await open(authUrl);
      console.log('Browser opened for GitHub login.');
    } catch (error) {
      console.error('Failed to open browser for GitHub login:', error);
    }

    onClose();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        const toolbarButtons = document.querySelectorAll('.toolbar-button');
        let isClickOnToolbarButton = false;

        toolbarButtons.forEach(button => {
          if (button.contains(event.target as Node)) {
            isClickOnToolbarButton = true;
          }
        });

        if (!isClickOnToolbarButton) {
          onClose();
        }
      }
    };

    if (isVisible) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  const handleLogout = () => {
    console.log('Logging out...');
    setAccessToken(null);
    setUserLogin(null);
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user_login');
    if (onLoginChange) {
      onLoginChange(null);
      console.log('onLoginChange called with null (logout)');
    }
    onClose();
  };

  console.log('Rendering AccountMenu...');
  console.log('Current accessToken:', accessToken);
  console.log('Current userLogin:', userLogin);

  if (!isVisible) return null;

  return (
    <div className="leftbar-account-overlay">
      <div className="leftbar-account-menu" ref={menuRef}>
        <div className="leftbar-account-header">
          <h3>Аккаунт</h3>
        </div>
        <div className="leftbar-account-content">
          {accessToken && userLogin ? (
            <div className="leftbar-account-item user-login">
              <span>Логин: {userLogin}</span>
            </div>
          ) : null}
          <div
            className="leftbar-account-item"
            onClick={() => {
              console.log('GitHub login button clicked!');
              handleGitHubLogin();
            }}
          >
            <Github size={16} />
            <span>Войти через GitHub</span>
          </div>
          <div className="leftbar-account-divider"></div>
          <div
            className="leftbar-account-item logout"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Выйти</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountMenu;