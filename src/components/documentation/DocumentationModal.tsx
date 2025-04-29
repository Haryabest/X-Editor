import React, { useState } from 'react';
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
  content: React.ReactNode;
}

const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('getting-started');

  // Определение разделов документации
  const sections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Начало работы',
      content: (
        <div>
          <h3>Начало работы с X-Editor</h3>
          <p>
            X-Editor предоставляет мощный интерфейс для разработки с поддержкой многих языков программирования.
            Чтобы начать работу, просто откройте каталог вашего проекта или создайте новый файл.
          </p>
          <h4>Создание нового файла</h4>
          <p>
            Для создания нового файла используйте меню <code>Файл → Новый файл</code> или комбинацию клавиш <code>Ctrl+N</code>.
          </p>
          <h4>Открытие проекта</h4>
          <p>
            Для открытия существующего проекта используйте меню <code>Файл → Открыть папку</code> или комбинацию клавиш <code>Ctrl+O</code>.
          </p>
        </div>
      )
    },
    {
      id: 'editor-features',
      title: 'Возможности редактора',
      content: (
        <div>
          <h3>Основные возможности редактора</h3>
          <h4>Интеллектуальное автодополнение</h4>
          <p>
            X-Editor включает в себя мощное автодополнение кода для большинства поддерживаемых языков.
            Автодополнение активируется автоматически при вводе или по комбинации <code>Ctrl+Space</code>.
          </p>
          <h4>Навигация по коду</h4>
          <p>
            Для быстрого поиска файлов используйте панель поиска вверху или комбинацию <code>Ctrl+P</code>.
            Для поиска символов внутри файла используйте <code>Ctrl+F</code>.
          </p>
          <h4>Работа с выделением</h4>
          <p>
            X-Editor предлагает расширенные возможности работы с выделенным текстом:
          </p>
          <ul>
            <li><strong>Выделить всё</strong>: <code>Ctrl+A</code></li>
            <li><strong>Отменить выделение</strong>: <code>Esc</code></li>
            <li><strong>Инвертировать выделение</strong>: <code>Shift+I</code></li>
            <li><strong>Расширенное выделение</strong>: <code>Alt+E</code></li>
          </ul>
        </div>
      )
    },
    {
      id: 'terminal',
      title: 'Работа с терминалом',
      content: (
        <div>
          <h3>Использование встроенного терминала</h3>
          <p>
            X-Editor имеет встроенный терминал для быстрого доступа к командной строке без переключения в отдельное приложение.
          </p>
          <h4>Открытие терминала</h4>
          <p>
            Для открытия терминала используйте меню <code>Консоль → Открыть консоль</code> или комбинацию клавиш <code>Ctrl+`</code>.
          </p>
          <h4>Команды терминала</h4>
          <p>
            В терминале вы можете выполнять любые команды, как в обычной командной строке вашей операционной системы.
            Текущий рабочий каталог терминала автоматически устанавливается на открытый проект.
          </p>
        </div>
      )
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Сочетания клавиш',
      content: (
        <div>
          <h3>Сочетания клавиш</h3>
          <p>X-Editor поддерживает множество сочетаний клавиш для повышения эффективности работы:</p>
          
          <table className="shortcut-table">
            <thead>
              <tr>
                <th>Действие</th>
                <th>Сочетание клавиш</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Новый файл</td>
                <td><code>Ctrl+N</code></td>
              </tr>
              <tr>
                <td>Открыть папку</td>
                <td><code>Ctrl+O</code></td>
              </tr>
              <tr>
                <td>Сохранить</td>
                <td><code>Ctrl+S</code></td>
              </tr>
              <tr>
                <td>Сохранить как</td>
                <td><code>Ctrl+Shift+S</code></td>
              </tr>
              <tr>
                <td>Выделить всё</td>
                <td><code>Ctrl+A</code></td>
              </tr>
              <tr>
                <td>Отменить выделение</td>
                <td><code>Esc</code></td>
              </tr>
              <tr>
                <td>Инвертировать выделение</td>
                <td><code>Shift+I</code></td>
              </tr>
              <tr>
                <td>Расширенное выделение</td>
                <td><code>Alt+E</code></td>
              </tr>
              <tr>
                <td>Поиск в файле</td>
                <td><code>Ctrl+F</code></td>
              </tr>
              <tr>
                <td>Открыть терминал</td>
                <td><code>Ctrl+`</code></td>
              </tr>
              <tr>
                <td>Полноэкранный режим</td>
                <td><code>F11</code></td>
              </tr>
              <tr>
                <td>Увеличить масштаб</td>
                <td><code>Ctrl++</code></td>
              </tr>
              <tr>
                <td>Уменьшить масштаб</td>
                <td><code>Ctrl+-</code></td>
              </tr>
              <tr>
                <td>Сбросить масштаб</td>
                <td><code>Ctrl+0</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Документация"
      width="800px"
      height="600px"
    >
      <div className="doc-sidebar">
        {sections.map(section => (
          <button
            key={section.id}
            className={`doc-nav-item ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.title}
          </button>
        ))}
      </div>
      <div className="doc-content">
        {sections.find(section => section.id === activeSection)?.content}
      </div>
    </Modal>
  );
};

export default DocumentationModal; 