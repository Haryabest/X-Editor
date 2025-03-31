import React, { useEffect } from 'react';

const AuthCallback: React.FC = () => {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const tokenMatch = hash.match(/access_token=([^&]+)/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        // Отправляем токен в основное окно через postMessage
        window.opener.postMessage(
          { type: 'github_auth_success', accessToken: token },
          window.location.origin
        );
        // Закрываем окно
        window.close();
      }
    }
  }, []);

  return <div>Обработка авторизации...</div>;
};

export default AuthCallback;