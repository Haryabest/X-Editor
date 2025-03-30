import React from 'react';
import Modal from '../modal/Modal';
import './AboutModal.css';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="О программе"
      width="600px"
    >
      <div className="about-content">
        <div className="about-logo">
          <img src="/icon.png" alt="X-Editor Logo" width={80} height={80} />
        </div>
        
        <h1>X-Editor</h1>
        <p className="version">Версия 1.0.0</p>
        
        <div className="about-info">
          <p>
            X-Editor - современный редактор кода с поддержкой множества языков программирования.
            Создан с использованием Tauri, React и Monaco Editor для обеспечения высокой производительности
            и гибкости разработки.
          </p>
          
          <h3>Технологии:</h3>
          <ul>
            <li><strong>Frontend:</strong> React, TypeScript</li>
            <li><strong>Backend:</strong> Rust, Tauri</li>
            <li><strong>Редактор:</strong> Monaco Editor (VS Code Engine)</li>
          </ul>
          
          <h3>Возможности:</h3>
          <ul>
            <li>Подсветка синтаксиса для множества языков</li>
            <li>Интеллектуальное автодополнение кода</li>
            <li>Встроенный терминал</li>
            <li>Настраиваемый интерфейс</li>
            <li>Быстрая навигация между файлами</li>
          </ul>
          
          <p className="copyright">© 2024 X-Editor. Все права защищены.</p>
        </div>
      </div>
    </Modal>
  );
};

export default AboutModal; 