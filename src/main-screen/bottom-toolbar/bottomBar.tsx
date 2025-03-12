import React, { useState } from 'react';
import { CircleX, CircleAlert, Bell, ChevronDown } from "lucide-react";

import './style.css';

const BottomToolbar: React.FC = () => {
  const [showLanguages, setShowLanguages] = useState(false);
  const [showEncodings, setShowEncodings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="bottom-toolbar">
      <div className="left-info">
        <button className="error-item">
          <CircleX width={14} height={14} />
          <span>0</span>
          <span className="tooltip">Ошибки</span>
        </button>
        <button className="problems-item">
          <CircleAlert width={14} height={14} />
          <span>0</span>
          <span className="tooltip">Предупреждения</span>
        </button>
      </div>

      <div className="right-info">
        <button className="right-item">
          <span>Строка, столбец</span>
          <span className="tooltip">Перейти к строке/столбцу</span>
        </button>

        <button className="right-item" onClick={() => setShowEncodings(!showEncodings)}>
          <span>UTF-8</span>
          <ChevronDown width={14} height={14} />
          <span className="tooltip">Выберите кодировку</span>
          {showEncodings && (
            <div className="dropdown">
              <div>UTF-8</div>
              <div>ASCII</div>
              <div>ISO-8859-1</div>
              <div>Windows-1251</div>
              <div>KOI8-R</div>
            </div>
          )}
        </button>

        <button className="right-item" onClick={() => setShowLanguages(!showLanguages)}>
          <span>Python</span>
          <ChevronDown width={14} height={14} />
          <span className="tooltip">Выберите язык</span>
          {showLanguages && (
            <div className="dropdown">
              <div>JavaScript</div>
              <div>TypeScript</div>
              <div>Python</div>
              <div>C++</div>
              <div>Rust</div>
              <div>Go</div>
            </div>
          )}
        </button>

        <button className="right-item" onClick={() => setShowNotifications(!showNotifications)}>
          <Bell width={14} height={14} />
          <span className="tooltip">Уведомления</span>
          {showNotifications && (
            <div className="dropdown notifications">
              <div>🔔 Новое обновление доступно</div>
              <div>📩 У вас 3 новых сообщения</div>
              <div>⚠️ Ошибка в коде на строке 25</div>
              <hr />
              <div>📝 Напоминание: сдача проекта в пятницу</div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default BottomToolbar;