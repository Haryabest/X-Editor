import React, { useRef, useEffect, useState } from 'react';
import { LogOut, Github } from 'lucide-react';
import './AccountMenu.css';

const GITHUB_CLIENT_ID = 'Ov23liWNwWqM9SO0J9nF'; // Ваш Client ID

interface AccountMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onLoginChange?: (login: string | null) => void; // Добавляем пропс для передачи логина
}

const AccountMenu: React.FC<AccountMenuProps> = ({ isVisible, onClose, onLoginChange }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userLogin, setUserLogin] = useState<string | null>(null);

  // Проверка сохраненного токена и получение данных пользователя при загрузке
  useEffect(() => {
    const savedToken = localStorage.getItem('github_token');
    const savedLogin = localStorage.getItem('github_user_login');

    if (savedToken) {
      setAccessToken(savedToken);
      if (savedLogin) {
        setUserLogin(savedLogin);
        if (onLoginChange) onLoginChange(savedLogin); // Передаем логин в родительский компонент
      } else {
        // Если логина нет, делаем запрос к GitHub API
        fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        })
          .then(res => res.json())
          .then(data => {
            if (data.login) {
              setUserLogin(data.login);
              localStorage.setItem('github_user_login', data.login);
              if (onLoginChange) onLoginChange(data.login); // Передаем логин
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
    }

    // Проверка URL на наличие токена после редиректа
    const hash = window.location.hash;
    if (hash) {
      const tokenMatch = hash.match(/access_token=([^&]+)/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        setAccessToken(token);
        localStorage.setItem('github_token', token);
        // Очищаем hash из URL
        window.history.pushState("", document.title, window.location.pathname + window.location.search);

        // Получаем данные пользователя
        fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then(res => res.json())
          .then(data => {
            if (data.login) {
              setUserLogin(data.login);
              localStorage.setItem('github_user_login', data.login);
              if (onLoginChange) onLoginChange(data.login); // Передаем логин
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
    }
  }, [onLoginChange]);

  // Обработка GitHub авторизации с Implicit Flow
  const handleGitHubLogin = () => {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${window.location.origin}`,
      response_type: 'token',
      scope: 'user:email',
      state: Math.random().toString(36).substring(7),
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  };

  // Обработка клика вне меню
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

  // Обработка выхода
  const handleLogout = () => {
    setAccessToken(null);
    setUserLogin(null);
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user_login');
    if (onLoginChange) onLoginChange(null); // Передаем null при выходе
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="leftbar-account-overlay">
      <div className="leftbar-account-menu" ref={menuRef}>
        <div className="leftbar-account-header">
          <h3>Аккаунт</h3>
        </div>
        <div className="leftbar-account-content">
          {!accessToken ? (
            <div
              className="leftbar-account-item"
              onClick={() => {
                handleGitHubLogin();
                onClose();
              }}
            >
              <Github size={16} />
              <span>Войти через GitHub</span>
            </div>
          ) : null}
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