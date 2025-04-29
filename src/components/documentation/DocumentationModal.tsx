import React, { useState, useEffect } from 'react';
import Modal from '../modal/Modal';
import './DocumentationModal.css';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Структура разделов документации
interface DocSection {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
}

// Интерфейс для горячих клавиш
interface Shortcut {
  keys: string[];
  description: string;
}

// Группы горячих клавиш
interface ShortcutGroup {
  [category: string]: Shortcut[];
}

const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [activeShortcutCategory, setActiveShortcutCategory] = useState('editor');

  // Определение горячих клавиш по категориям
  const shortcutGroups: ShortcutGroup = {
    general: [
      { keys: ['Ctrl', 'N'], description: 'Новый файл' },
      { keys: ['Ctrl', 'O'], description: 'Открыть файл/папку' },
      { keys: ['Ctrl', 'S'], description: 'Сохранить' },
      { keys: ['Ctrl', 'Shift', 'S'], description: 'Сохранить как' },
      { keys: ['Ctrl', 'Shift', 'P'], description: 'Открыть командную палитру' },
      { keys: ['Ctrl', 'W'], description: 'Закрыть файл' },
      { keys: ['Alt', 'F4'], description: 'Выход из редактора' }
    ],
    editing: [
      { keys: ['Ctrl', 'X'], description: 'Вырезать' },
      { keys: ['Ctrl', 'C'], description: 'Копировать' },
      { keys: ['Ctrl', 'V'], description: 'Вставить' },
      { keys: ['Ctrl', 'Z'], description: 'Отменить' },
      { keys: ['Ctrl', 'Y'], description: 'Повторить' },
      { keys: ['Alt', 'Click'], description: 'Мультикурсор' },
      { keys: ['Ctrl', 'D'], description: 'Выделить следующее вхождение' },
      { keys: ['Ctrl', 'Alt', '↑/↓'], description: 'Добавить курсор сверху/снизу' },
      { keys: ['Shift', 'Alt', '↓'], description: 'Дублировать строку' },
      { keys: ['Ctrl', 'Shift', 'K'], description: 'Удалить строку' },
      { keys: ['Ctrl', '/'], description: 'Закомментировать' }
    ],
    navigation: [
      { keys: ['Ctrl', 'F'], description: 'Поиск в файле' },
      { keys: ['Ctrl', 'H'], description: 'Замена в файле' },
      { keys: ['Ctrl', 'Shift', 'F'], description: 'Поиск по проекту' },
      { keys: ['Ctrl', 'P'], description: 'Быстрый переход к файлу' },
      { keys: ['Ctrl', 'G'], description: 'Переход к строке' },
      { keys: ['F12'], description: 'Перейти к определению' },
      { keys: ['Alt', '←/→'], description: 'Назад/вперед' },
      { keys: ['Ctrl', 'Tab'], description: 'Переключение между файлами' }
    ],
    terminal: [
      { keys: ['Ctrl', '`'], description: 'Открыть/закрыть терминал' },
      { keys: ['Ctrl', 'Shift', '`'], description: 'Новый терминал' },
      { keys: ['Ctrl', 'Alt', 'C'], description: 'Очистить терминал' },
      { keys: ['Ctrl', '↑/↓'], description: 'Прокрутка истории терминала' },
      { keys: ['Ctrl', 'PgUp/PgDn'], description: 'Переключение между терминалами' }
    ],
    git: [
      { keys: ['Ctrl', 'Shift', 'G'], description: 'Открыть панель Git' },
      { keys: ['Ctrl', 'Enter'], description: 'Создать коммит' },
      { keys: ['Ctrl', 'Shift', 'E'], description: 'Опубликовать ветку' },
      { keys: ['Alt', '↑/↓'], description: 'Переход по изменениям' },
      { keys: ['Ctrl', 'Shift', 'B'], description: 'Создать ветку' },
      { keys: ['Ctrl', 'Shift', 'X'], description: 'Переключить ветку' }
    ]
  };

  // Функция для рендера комбинации клавиш
  const renderKeyCombo = (keys: string[]) => (
    <div className="shortcut-combo">
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="key-separator">+</span>}
          <span className="key">{key}</span>
        </React.Fragment>
      ))}
    </div>
  );

  // Функция для рендера списка горячих клавиш
  const renderShortcutList = (shortcuts: Shortcut[]) => (
    <div className="doc-shortcut-list">
      {shortcuts.map((shortcut, index) => (
        <div className="shortcut-item" key={index}>
          {renderKeyCombo(shortcut.keys)}
          <div className="shortcut-description">{shortcut.description}</div>
        </div>
      ))}
    </div>
  );

  // Раздел с горячими клавишами
  const KeyboardShortcutsSection = () => {
    const [activeShortcutCategory, setActiveShortcutCategory] = useState('editor');
  
    const shortcutCategories = [
      { id: 'editor', name: 'Редактор', icon: '✏️' },
      { id: 'navigation', name: 'Навигация', icon: '🧭' },
      { id: 'git', name: 'Git', icon: '📊' },
      { id: 'terminal', name: 'Терминал', icon: '💻' },
      { id: 'search', name: 'Поиск', icon: '🔍' },
      { id: 'files', name: 'Файлы', icon: '📁' },
      { id: 'windows', name: 'Окна', icon: '🪟' },
    ];
    
    const shortcuts = {
      editor: [
        { keys: ['Ctrl', 'Space'], description: 'Автодополнение кода' },
        { keys: ['Ctrl', '/'], description: 'Закомментировать/раскомментировать строку' },
        { keys: ['Ctrl', 'D'], description: 'Выделить следующее вхождение текущего выделения' },
        { keys: ['Alt', 'Z'], description: 'Включить/выключить перенос строк' },
        { keys: ['Ctrl', 'K', 'Ctrl', 'F'], description: 'Форматировать выделенный код' },
        { keys: ['Ctrl', 'Shift', 'L'], description: 'Выбрать все вхождения текущего выделения' },
        { keys: ['Ctrl', '['], description: 'Увеличить отступ строки' },
        { keys: ['Ctrl', ']'], description: 'Уменьшить отступ строки' },
        { keys: ['Alt', '↑'], description: 'Переместить строку вверх' },
        { keys: ['Alt', '↓'], description: 'Переместить строку вниз' },
      ],
      navigation: [
        { keys: ['Ctrl', 'G'], description: 'Перейти к строке' },
        { keys: ['Ctrl', 'P'], description: 'Быстрый переход к файлу' },
        { keys: ['Alt', '←'], description: 'Назад' },
        { keys: ['Alt', '→'], description: 'Вперед' },
        { keys: ['Ctrl', 'Tab'], description: 'Переключение между открытыми файлами' },
        { keys: ['Ctrl', 'F12'], description: 'Перейти к определению' },
        { keys: ['Alt', 'F12'], description: 'Показать определение' },
        { keys: ['F12'], description: 'Перейти к реализации' },
        { keys: ['Ctrl', '-'], description: 'Навигация назад' },
        { keys: ['Ctrl', 'Shift', '-'], description: 'Навигация вперед' },
      ],
      git: [
        { keys: ['Ctrl', 'Shift', 'G'], description: 'Открыть Git панель' },
        { keys: ['Ctrl', 'Enter'], description: 'Сделать коммит (в окне ввода сообщения)' },
        { keys: ['Alt', 'C'], description: 'Сравнить с предыдущей версией' },
        { keys: ['Alt', 'B'], description: 'Просмотреть ветки' },
        { keys: ['Ctrl', 'Shift', 'P', 'then', 'Git: Clone'], description: 'Клонировать репозиторий' },
        { keys: ['Ctrl', 'Shift', 'P', 'then', 'Git: Checkout to'], description: 'Переключиться на ветку' },
      ],
      terminal: [
        { keys: ['Ctrl', '`'], description: 'Показать/скрыть терминал' },
        { keys: ['Ctrl', 'Shift', '`'], description: 'Создать новый терминал' },
        { keys: ['Ctrl', 'Shift', '5'], description: 'Разделить терминал' },
        { keys: ['Ctrl', 'Shift', 'C'], description: 'Копировать выделенное в терминале' },
        { keys: ['Ctrl', 'Shift', 'V'], description: 'Вставить в терминал' },
        { keys: ['Ctrl', 'Alt', '↑/↓'], description: 'Прокрутка терминала вверх/вниз' },
      ],
      search: [
        { keys: ['Ctrl', 'F'], description: 'Поиск в текущем файле' },
        { keys: ['Ctrl', 'H'], description: 'Замена в текущем файле' },
        { keys: ['Ctrl', 'Shift', 'F'], description: 'Поиск по всем файлам' },
        { keys: ['Ctrl', 'Shift', 'H'], description: 'Замена по всем файлам' },
        { keys: ['Alt', 'Enter'], description: 'Выбрать все вхождения найденного текста' },
        { keys: ['F3'], description: 'Найти следующее' },
        { keys: ['Shift', 'F3'], description: 'Найти предыдущее' },
      ],
      files: [
        { keys: ['Ctrl', 'N'], description: 'Новый файл' },
        { keys: ['Ctrl', 'O'], description: 'Открыть файл' },
        { keys: ['Ctrl', 'S'], description: 'Сохранить файл' },
        { keys: ['Ctrl', 'Shift', 'S'], description: 'Сохранить как' },
        { keys: ['Ctrl', 'K', 'S'], description: 'Сохранить все' },
        { keys: ['Ctrl', 'W'], description: 'Закрыть файл' },
        { keys: ['Ctrl', 'K', 'W'], description: 'Закрыть все файлы' },
      ],
      windows: [
        { keys: ['Ctrl', 'B'], description: 'Показать/скрыть боковую панель' },
        { keys: ['Ctrl', 'Shift', 'E'], description: 'Показать проводник' },
        { keys: ['Ctrl', 'Shift', 'D'], description: 'Показать панель отладки' },
        { keys: ['Ctrl', 'Shift', 'X'], description: 'Показать расширения' },
        { keys: ['Ctrl', '\\'], description: 'Разделить редактор' },
        { keys: ['Ctrl', '1/2/3'], description: 'Переключиться на первую/вторую/третью группу редакторов' },
        { keys: ['F11'], description: 'Полноэкранный режим' },
        { keys: ['Ctrl', '+/-'], description: 'Увеличить/уменьшить масштаб' },
      ]
    };
    
    const renderKey = (key: string) => {
      if (key === 'then') {
        return <span className="key-plus">затем</span>;
      }
      return <span className="key">{key}</span>;
    };
    
    return (
      <div className="keyboard-shortcuts-section">
        <div className="shortcuts-header">
          <h2>Горячие клавиши</h2>
          <p>Используйте эти комбинации клавиш для быстрой работы в X-Editor</p>
        </div>
        
        <div className="shortcuts-content">
          <div className="doc-shortcut-categories">
            {shortcutCategories.map(category => (
              <div 
                key={category.id}
                className={`doc-shortcut-category ${activeShortcutCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveShortcutCategory(category.id)}
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-name">{category.name}</span>
              </div>
            ))}
          </div>
          
          <div className="doc-shortcut-list">
            {shortcuts[activeShortcutCategory as keyof typeof shortcuts]?.map((shortcut, index) => (
              <div key={index} className="shortcut-item">
                <div className="shortcut-description">{shortcut.description}</div>
                <div className="shortcut-combo">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      {renderKey(key)}
                      {keyIndex < shortcut.keys.length - 1 && key !== 'then' && (
                        <span className="key-plus">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Определение разделов документации
  const sections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Начало работы',
      icon: '🚀',
      content: (
        <div>
          <h3>Начало работы с X-Editor</h3>
          
          <div className="doc-step-container">
            <div className="doc-step">
              <div className="doc-step-number">1</div>
              <div className="doc-step-content">
                <h4>Загрузка</h4>
                <p>Скачайте последнюю версию с официального сайта X-Editor для вашей платформы</p>
              </div>
            </div>
            <div className="doc-step">
              <div className="doc-step-number">2</div>
              <div className="doc-step-content">
                <h4>Установка</h4>
                <p>Запустите установщик и следуйте инструкциям на экране</p>
              </div>
            </div>
            <div className="doc-step">
              <div className="doc-step-number">3</div>
              <div className="doc-step-content">
                <h4>Настройка</h4>
                <p>При первом запуске выберите тему и базовые настройки редактора</p>
              </div>
            </div>
            <div className="doc-step">
              <div className="doc-step-number">4</div>
              <div className="doc-step-content">
                <h4>Готово!</h4>
                <p>Создайте новый проект или откройте существующий</p>
              </div>
            </div>
          </div>
          
          <div className="doc-info-panel">
            <div className="doc-info-icon">💡</div>
            <div className="doc-info-content">
              <p><strong>Совет:</strong> Установите расширения для языков, с которыми вы планируете работать, чтобы получить максимум от X-Editor.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'editor-workflow',
      title: 'Рабочий процесс',
      icon: '⚡',
      content: (
        <div>
          <h3>Эффективный рабочий процесс</h3>
          
          <div className="doc-columns">
            <div className="doc-column">
              <div className="doc-card">
                <h4>Создание проекта</h4>
                <div className="doc-code-snippet">
                  <pre><code>Ctrl+N → Новый проект</code></pre>
                </div>
                <p>Быстро создавайте новые проекты с шаблонами для разных языков и фреймворков.</p>
              </div>
            </div>
            <div className="doc-column">
              <div className="doc-card">
                <h4>Управление файлами</h4>
                <div className="doc-code-snippet">
                  <pre><code>Ctrl+P → Поиск файлов</code></pre>
                </div>
                <p>Быстрый поиск и навигация по файлам проекта одной комбинацией клавиш.</p>
              </div>
            </div>
          </div>

          <div className="doc-feature-showcase">
            <div className="doc-feature-image">
              <div className="placeholder-image">Мульти-курсор</div>
            </div>
            <div className="doc-feature-description">
              <h4>Мультикурсорное редактирование</h4>
              <p>Редактируйте несколько строк одновременно с помощью Alt+Click или Ctrl+Alt+↑/↓</p>
              <ul className="doc-feature-list">
                <li>Одновременное редактирование нескольких мест</li>
                <li>Быстрый рефакторинг повторяющегося кода</li>
                <li>Умное выделение похожих фрагментов (Ctrl+D)</li>
              </ul>
            </div>
          </div>
          
          <div className="doc-info-panel warning">
            <div className="doc-info-icon">⚠️</div>
            <div className="doc-info-content">
              <p><strong>Внимание:</strong> Регулярно сохраняйте свою работу (Ctrl+S). Автосохранение включено по умолчанию, но лучше перестраховаться.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'terminal',
      title: 'Встроенный терминал',
      icon: '💻',
      content: (
        <div>
          <h3>Встроенный терминал</h3>
          
          <div className="doc-feature-showcase reversed">
            <div className="doc-feature-image">
              <div className="placeholder-image">Терминал</div>
            </div>
            <div className="doc-feature-description">
              <h4>Полнофункциональный терминал</h4>
              <p>Доступ к командной строке без необходимости покидать редактор</p>
              <div className="doc-keyboard-shortcut">
                <span className="key">Ctrl</span> + <span className="key">`</span>
              </div>
            </div>
          </div>
          
          <div className="doc-card">
            <h4>Особенности терминала</h4>
            <div className="doc-checklist">
              <div className="doc-check-item">
                <div className="doc-check-icon">✓</div>
                <div>Поддержка всех командных оболочек (bash, PowerShell, cmd)</div>
              </div>
              <div className="doc-check-item">
                <div className="doc-check-icon">✓</div>
                <div>Автоматическая настройка рабочего каталога проекта</div>
              </div>
              <div className="doc-check-item">
                <div className="doc-check-icon">✓</div>
                <div>Разделение терминала на несколько панелей</div>
              </div>
              <div className="doc-check-item">
                <div className="doc-check-icon">✓</div>
                <div>Кликабельные сообщения об ошибках для быстрого перехода</div>
              </div>
            </div>
          </div>
          
          <div className="doc-command-examples">
            <h4>Полезные команды терминала</h4>
            <div className="doc-command">
              <div className="doc-command-text">git status</div>
              <div className="doc-command-description">Проверить статус Git-репозитория</div>
            </div>
            <div className="doc-command">
              <div className="doc-command-text">npm install</div>
              <div className="doc-command-description">Установить зависимости проекта</div>
            </div>
            <div className="doc-command">
              <div className="doc-command-text">python -m venv env</div>
              <div className="doc-command-description">Создать виртуальное окружение Python</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'git-integration',
      title: 'Git интеграция',
      icon: '📊',
      content: (
        <div>
          <h3>Интеграция с Git</h3>
          
          <div className="doc-workflow-diagram">
            <div className="workflow-step">
              <div className="workflow-icon">🔄</div>
              <div className="workflow-title">Клонирование</div>
              <div className="workflow-description">Клонирование репозитория</div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <div className="workflow-icon">📝</div>
              <div className="workflow-title">Изменения</div>
              <div className="workflow-description">Внесение изменений</div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <div className="workflow-icon">➕</div>
              <div className="workflow-title">Индекс</div>
              <div className="workflow-description">Добавление в индекс</div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <div className="workflow-icon">📦</div>
              <div className="workflow-title">Коммит</div>
              <div className="workflow-description">Фиксация изменений</div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <div className="workflow-icon">☁️</div>
              <div className="workflow-title">Пуш</div>
              <div className="workflow-description">Отправка на сервер</div>
            </div>
          </div>
          
          <div className="doc-git-actions">
            <div className="doc-action-card">
              <h4>Клонирование репозитория</h4>
              <div className="doc-action-steps">
                <p>1. Нажмите кнопку <strong>Клонировать</strong> в верхней панели</p>
                <p>2. Введите URL репозитория</p>
                <p>3. Выберите папку назначения</p>
                <p>4. Нажмите <strong>Клонировать</strong></p>
              </div>
            </div>
            
            <div className="doc-action-card">
              <h4>Работа с изменениями</h4>
              <p>Все изменения отображаются визуально:</p>
              <div className="doc-color-legend">
                <div className="color-item">
                  <div className="color-box added"></div>
                  <div className="color-description">Добавленные строки</div>
                </div>
                <div className="color-item">
                  <div className="color-box modified"></div>
                  <div className="color-description">Измененные строки</div>
                </div>
                <div className="color-item">
                  <div className="color-box deleted"></div>
                  <div className="color-description">Удаленные строки</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="doc-git-shortcuts">
            <h4>Горячие клавиши Git</h4>
            <div className="shortcut-grid">
              <div className="shortcut-item">
                <div className="shortcut-keys">Ctrl+Shift+G</div>
                <div className="shortcut-desc">Открыть панель Git</div>
              </div>
              <div className="shortcut-item">
                <div className="shortcut-keys">Ctrl+Enter</div>
                <div className="shortcut-desc">Создать коммит</div>
              </div>
              <div className="shortcut-item">
                <div className="shortcut-keys">Alt+↑/↓</div>
                <div className="shortcut-desc">Переход по изменениям</div>
              </div>
              <div className="shortcut-item">
                <div className="shortcut-keys">Ctrl+Shift+B</div>
                <div className="shortcut-desc">Создать ветку</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Горячие клавиши',
      icon: '⌨️',
      content: <KeyboardShortcutsSection />
    },
    {
      id: 'code-intelligence',
      title: 'Умный код',
      icon: '🧠',
      content: (
        <div>
          <h3>Интеллектуальные возможности</h3>
          
          <div className="doc-comparison-table">
            <div className="comparison-header">
              <div className="comparison-feature">Возможность</div>
              <div className="comparison-basic">Базовая поддержка</div>
              <div className="comparison-full">Полная поддержка</div>
            </div>
            <div className="comparison-row">
              <div className="comparison-feature">Автодополнение</div>
              <div className="comparison-basic">
                <span className="check">✓</span>
                <span className="desc">Стандартное</span>
              </div>
              <div className="comparison-full">
                <span className="check">✓</span>
                <span className="desc">С учетом типов и контекста</span>
              </div>
            </div>
            <div className="comparison-row">
              <div className="comparison-feature">Анализ кода</div>
              <div className="comparison-basic">
                <span className="check">✓</span>
                <span className="desc">Синтаксические ошибки</span>
              </div>
              <div className="comparison-full">
                <span className="check">✓</span>
                <span className="desc">Семантический анализ</span>
              </div>
            </div>
            <div className="comparison-row">
              <div className="comparison-feature">Рефакторинг</div>
              <div className="comparison-basic">
                <span className="check">✓</span>
                <span className="desc">Переименование</span>
              </div>
              <div className="comparison-full">
                <span className="check">✓</span>
                <span className="desc">Полный набор операций</span>
              </div>
            </div>
            <div className="comparison-row">
              <div className="comparison-feature">Навигация</div>
              <div className="comparison-basic">
                <span className="check">✓</span>
                <span className="desc">По ссылкам</span>
              </div>
              <div className="comparison-full">
                <span className="check">✓</span>
                <span className="desc">По всему проекту</span>
              </div>
            </div>
          </div>
          
          <div className="doc-feature-grid">
            <div className="feature-grid-item">
              <div className="feature-icon">🔍</div>
              <h4>Умный поиск</h4>
              <p>Поиск с пониманием семантики кода и символов</p>
            </div>
            <div className="feature-grid-item">
              <div className="feature-icon">🛠️</div>
              <h4>Быстрые исправления</h4>
              <p>Предложения по исправлению проблем</p>
            </div>
            <div className="feature-grid-item">
              <div className="feature-icon">📝</div>
              <h4>Умное форматирование</h4>
              <p>Автоматическое форматирование согласно стилю</p>
            </div>
            <div className="feature-grid-item">
              <div className="feature-icon">🔄</div>
              <h4>Рефакторинг</h4>
              <p>Извлечение функций, переменных и другие трансформации</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Документация"
      width="900px"
      height="700px"
    >
      <div className="documentation-modal">
        <div className="doc-sidebar">
          {sections.map(section => (
            <button
              key={section.id}
              className={`doc-nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="nav-icon">{section.icon}</span>
              {section.title}
            </button>
          ))}
        </div>
        <div className="doc-content">
          {sections.find(section => section.id === activeSection)?.content}
        </div>
      </div>
    </Modal>
  );
};

export default DocumentationModal; 