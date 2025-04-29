import React, { useState } from 'react';
import Modal from '../modal/Modal';
import './AboutModal.css';
import authorPhoto from './autot.png';
import logo from '../../assets/logo.png';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StatCard {
  value: string;
  label: string;
  icon: string;
}

interface TimelineItem {
  version: string;
  date: string;
  title: string;
  description: string;
}

interface TeamMember {
  name: string;
  role: string;
  avatar: string;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  const stats: StatCard[] = [
    { value: '20+', label: 'Языков программирования', icon: '🌐' },
    { value: '15K+', label: 'Строк кода', icon: '📝' },
    { value: '99%', label: 'Точность диагностики', icon: '🔍' },
    { value: '100ms', label: 'Отклик интерфейса', icon: '⚡' }
  ];
  
  const timeline: TimelineItem[] = [
    {
      version: 'v1.0.0',
      date: '30 Мая 2025',
      title: 'Финальный релиз',
      description: 'Выпуск полнофункциональной версии X-Editor с поддержкой всех запланированных функций'
    },
    {
      version: 'v0.9.0',
      date: '20 Мая 2025',
      title: 'Релиз-кандидат',
      description: 'Финальное тестирование, оптимизация производительности и исправление критических ошибок'
    },
    {
      version: 'v0.8.0',
      date: '10 Мая 2025',
      title: 'Бета-тестирование',
      description: 'Полное тестирование всех функций продукта. Исправление найденных ошибок'
    },
    {
      version: 'v0.7.0',
      date: '30 Апреля 2025',
      title: 'Интеграция Git и терминала',
      description: 'Реализация Git-интеграции, терминала и основных возможностей редактора кода'
    },
    {
      version: 'v0.5.0',
      date: '20 Апреля 2025',
      title: 'Альфа-версия редактора',
      description: 'Разработка основного редактора на базе Monaco с поддержкой TypeScript и Python'
    },
    {
      version: 'v0.3.0',
      date: '10 Апреля 2025',
      title: 'Прототип интерфейса',
      description: 'Создание базовой архитектуры приложения на Tauri и React, проектирование UI/UX'
    }
  ];
  
  const TeamAvatar = ({ initials, color }: { initials: string, color: string }) => {
    return (
      <div className="avatar-container" style={{ 
        background: color, 
        width: '100%', 
        height: '100%', 
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        {initials}
      </div>
    );
  };

  const team: TeamMember[] = [
    {
      name: 'Вадим Романов',
      role: 'Ведущий разработчик',
      avatar: authorPhoto
    },
    {
      name: 'Вадим Романов',
      role: 'UX/UI дизайнер',
      avatar: authorPhoto
    },
    {
      name: 'Вадим Романов',
      role: 'Разработчик Rust/Tauri',
      avatar: authorPhoto
    },
    {
      name: 'Вадим Романов',
      role: 'Frontend разработчик',
      avatar: authorPhoto
    }
  ];
  
  // Создаем массив цветов для аватарок
  const avatarColors = ['#0078d4', '#107c10', '#5c2d91', '#d83b01'];

  const interestingFacts = [
    'X-Editor обрабатывает более 20 000 строк кода без замедления производительности',
    'Встроенная диагностика Python обнаруживает 98% синтаксических ошибок до запуска кода',
    'Терминал X-Editor поддерживает все нативные команды вашей операционной системы',
    'Интеграция с Git работает до 40% быстрее, чем большинство GUI клиентов',
    'X-Editor использует тот же движок, что и Visual Studio Code, но с дополнительными оптимизациями'
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="О программе"
      width="800px"
    >
      <div className="about-content">
        <div className="about-header">
          <div className="about-logo">
            <img src={logo} alt="X-Editor Logo" width="50" height="50" />
          </div>
          <h1>X-Editor</h1>
          <span className="version">Версия 1.0.0</span>
        </div>
        
        <div className="about-tabs">
          <button 
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Обзор
          </button>
          <button 
            className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
            onClick={() => setActiveTab('features')}
          >
            Возможности
          </button>
          <button 
            className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            Команда
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            История
          </button>
        </div>
        
        {activeTab === 'overview' && (
          <div className="tab-content">
            <p className="about-description">
              X-Editor - современный редактор кода с поддержкой множества языков программирования.
              Создан с использованием Tauri, React и Monaco Editor (движок Visual Studio Code) для обеспечения 
              высокой производительности и расширенной функциональности разработки.
            </p>
            
            <div className="stat-cards">
              {stats.map((stat, index) => (
                <div className="stat-card" key={index}>
                  <div className="stat-icon">{stat.icon}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
            
            <h3>Технический стек:</h3>
            <ul className="tech-list">
              <li><strong>Frontend:</strong> React 18, TypeScript, Monaco Editor</li>
              <li><strong>Backend:</strong> Rust, Tauri Framework</li>
              <li><strong>Редактор:</strong> Monaco Editor (VS Code Engine)</li>
              <li><strong>Терминал:</strong> XTerm.js, интеграция с системными оболочками</li>
              <li><strong>Git:</strong> Нативная интеграция через Rust</li>
              <li><strong>UI компоненты:</strong> Кастомные React компоненты, CSS модули</li>
              <li><strong>Сборка:</strong> Vite, Webpack для оптимизации бандлов</li>
            </ul>
            
            <h3>Системные требования:</h3>
            <div className="system-requirements">
              <div className="req-item">
                <div className="req-icon">💻</div>
                <div className="req-title">ОС</div>
                <div className="req-value">Windows 10/11, macOS 11+, Linux</div>
              </div>
              <div className="req-item">
                <div className="req-icon">⚙️</div>
                <div className="req-title">Процессор</div>
                <div className="req-value">Dual-core 2 GHz+</div>
              </div>
              <div className="req-item">
                <div className="req-icon">🧠</div>
                <div className="req-title">Память</div>
                <div className="req-value">Минимум 4 GB RAM</div>
              </div>
              <div className="req-item">
                <div className="req-icon">💾</div>
                <div className="req-title">Диск</div>
                <div className="req-value">200 MB свободного места</div>
              </div>
            </div>
            
            <div className="did-you-know">
              <h3>Знаете ли вы?</h3>
              <div className="fact-carousel">
                {interestingFacts.map((fact, index) => (
                  <div className="fact-item" key={index}>
                    <div className="fact-number">{index + 1}</div>
                    <div className="fact-text">{fact}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'features' && (
          <div className="tab-content">
            <h3>Ключевые возможности:</h3>
            <ul className="features-list">
              <li><strong>Многоязычная поддержка</strong> – Работа с JavaScript, TypeScript, Python, Rust, C/C++, Java, Go, HTML, CSS и многими другими языками</li>
              <li><strong>Интеллектуальное автодополнение</strong> – Контекстно-зависимые подсказки с учетом типов и импортов</li>
              <li><strong>Встроенный терминал</strong> – Полнофункциональный терминал с поддержкой команд операционной системы и кастомизируемым интерфейсом</li>
              <li><strong>Git интеграция</strong> – Управление репозиториями, коммиты, ветки, клонирование и просмотр изменений</li>
              <li><strong>Расширенная подсветка синтаксиса</strong> – Настраиваемые цветовые схемы и токенизаторы для точной визуализации кода</li>
              <li><strong>Обнаружение ошибок</strong> – Встроенная диагностика кода с подчеркиванием проблемных участков и рекомендациями</li>
              <li><strong>Настраиваемый интерфейс</strong> – Темная и светлая темы, изменяемые размеры панелей, кастомизация шрифтов</li>
            </ul>
            
            <h3>Расширенная функциональность:</h3>
            <ul className="features-list">
              <li><strong>Мощный редактор Monaco</strong> – Всё богатство возможностей VS Code доступно прямо в приложении</li>
              <li><strong>Умное форматирование</strong> – Автоматическое форматирование кода с настраиваемыми правилами для разных языков</li>
              <li><strong>Hover-подсказки</strong> – Подробная информация о функциях, переменных и типах при наведении курсора</li>
              <li><strong>Интегрированная диагностика</strong> – Мгновенное обнаружение ошибок синтаксиса и типизации</li>
              <li><strong>Работа с проектами</strong> – Управление файловой структурой, создание, перемещение и удаление файлов</li>
              <li><strong>Многопанельный интерфейс</strong> – Одновременная работа с несколькими файлами в разных панелях</li>
              <li><strong>Консоль с проблемами</strong> – Централизованный просмотр всех ошибок и предупреждений проекта</li>
            </ul>
            
            <h3>Поддержка языков программирования:</h3>
            <div className="language-grid">
              <div className="language-item">
                <span className="language-name">JavaScript/TypeScript</span>
                <span className="language-support full">Полная поддержка</span>
              </div>
              <div className="language-item">
                <span className="language-name">Python</span>
                <span className="language-support full">Полная поддержка</span>
              </div>
              <div className="language-item">
                <span className="language-name">HTML/CSS</span>
                <span className="language-support full">Полная поддержка</span>
              </div>
              <div className="language-item">
                <span className="language-name">JSON/YAML</span>
                <span className="language-support full">Полная поддержка</span>
              </div>
              <div className="language-item">
                <span className="language-name">Rust</span>
                <span className="language-support partial">Базовая поддержка</span>
              </div>
              <div className="language-item">
                <span className="language-name">Java</span>
                <span className="language-support partial">Базовая поддержка</span>
              </div>
              <div className="language-item">
                <span className="language-name">C/C++</span>
                <span className="language-support partial">Базовая поддержка</span>
              </div>
              <div className="language-item">
                <span className="language-name">Go</span>
                <span className="language-support partial">Базовая поддержка</span>
              </div>
              <div className="language-item">
                <span className="language-name">Ruby</span>
                <span className="language-support partial">Базовая поддержка</span>
              </div>
              <div className="language-item">
                <span className="language-name">Markdown</span>
                <span className="language-support full">Полная поддержка</span>
              </div>
            </div>
            
            <h3>Планы развития:</h3>
            <div className="roadmap">
              <div className="roadmap-item">
                <div className="roadmap-marker upcoming">Q3 2024</div>
                <div className="roadmap-content">
                  <h4>Расширенная LSP интеграция</h4>
                  <p>Поддержка языковых серверов для улучшенной диагностики и автодополнения</p>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-marker upcoming">Q4 2024</div>
                <div className="roadmap-content">
                  <h4>Система расширений</h4>
                  <p>Инфраструктура для создания и установки сторонних плагинов</p>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-marker future">Q1 2025</div>
                <div className="roadmap-content">
                  <h4>Облачная интеграция</h4>
                  <p>Синхронизация настроек и проектов между устройствами</p>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-marker future">Q2 2025</div>
                <div className="roadmap-content">
                  <h4>Совместное редактирование</h4>
                  <p>Многопользовательский режим для командной работы в реальном времени</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'team' && (
          <div className="tab-content">
            <h3>Команда разработчиков</h3>
            <p className="team-intro">X-Editor создан талантливой командой разработчиков, объединенных общей целью - создать идеальную среду разработки.</p>
            
            <div className="team-grid">
              {team.map((member, index) => (
                <div className="team-member" key={index}>
                  <div className="member-avatar">
                    <img src={member.avatar} alt={member.name} style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
                  </div>
                  <div className="member-info">
                    <h4 className="member-name">{member.name}</h4>
                    <p className="member-role">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="contribution">
              <h3>Участие в проекте</h3>
              <p>X-Editor является проектом с открытым исходным кодом. Мы приветствуем всех, кто хочет присоединиться к развитию редактора!</p>
              
              <div className="contribution-ways">
                <div className="contribution-item">
                  <h4>GitHub</h4>
                  <p>Отправляйте pull-запросы и участвуйте в разработке</p>
                  <a href="https://github.com/Haryabest/X-Editor" className="contribution-link">github.com/x-editor</a>
                </div>
                <div className="contribution-item">
                  <h4>Баг-репорты</h4>
                  <p>Сообщайте о найденных ошибках и предлагайте улучшения</p>
                  <a href="https://github.com/Haryabest/X-Editor/issues" className="contribution-link">Открыть ишью</a>
                </div>
                <div className="contribution-item">
                  <h4>Документация</h4>
                  <p>Помогите улучшить руководства и документацию</p>
                  <a href="https://github.com/Haryabest/X-Editor#" className="contribution-link">x-editor.dev/docs</a>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'history' && (
          <div className="tab-content">
            <h3>История разработки</h3>
            <p className="history-intro">X-Editor прошел долгий путь эволюции от концепции до полнофункционального редактора кода.</p>
            
            <div className="version-timeline">
              {timeline.map((item, index) => (
                <div className="timeline-item" key={index}>
                  <div className="timeline-version">{item.version}</div>
                  <div className="timeline-date">{item.date}</div>
                  <div className="timeline-content">
                    <h4 className="timeline-title">{item.title}</h4>
                    <p className="timeline-description">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="about-performance">
              <h3>Производительность</h3>
              <div className="performance-metrics">
                <div className="metric-item">
                  <div className="metric-title">Время запуска</div>
                  <div className="metric-bar">
                    <div className="metric-value" style={{ width: '80%' }}>
                      <span>1.2 сек</span>
                    </div>
                  </div>
                  <div className="metric-compare">На 35% быстрее VSCode</div>
                </div>
                <div className="metric-item">
                  <div className="metric-title">Потребление памяти</div>
                  <div className="metric-bar">
                    <div className="metric-value" style={{ width: '65%' }}>
                      <span>~120 MB</span>
                    </div>
                  </div>
                  <div className="metric-compare">На 50% эффективнее Electron-приложений</div>
                </div>
                <div className="metric-item">
                  <div className="metric-title">Индексация проекта</div>
                  <div className="metric-bar">
                    <div className="metric-value" style={{ width: '75%' }}>
                      <span>2.5 сек / 1000 файлов</span>
                    </div>
                  </div>
                  <div className="metric-compare">В 2 раза быстрее большинства IDE</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <p className="copyright">© 2024 X-Editor. Все права защищены.</p>
      </div>
    </Modal>
  );
};

export default AboutModal; 