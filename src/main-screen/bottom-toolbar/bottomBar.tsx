import React from 'react';
import { CircleX, CircleAlert } from "lucide-react";

import './style.css';

const BottomToolbar: React.FC = () => {
  return (
    <div className="bottom-toolbar">
      <div className="left-info">
        <div className="error-item">
          <CircleX width={16} height={16} />
          <span>0</span>
          <span className="tooltip">Ошибки</span>
        </div>
        <div className="problems-item">
          <CircleAlert width={16} height={16} />
          <span>0</span>
          <span className="tooltip">Предупреждения</span>
        </div>
      </div>
      <div className="right-info">
        <div className="error-item">
          <CircleX width={16} height={16} />
          <span>0</span>
          <span className="tooltip">Ошибки</span>
        </div>
        <div className="problems-item">
          <CircleAlert width={16} height={16} />
          <span>0</span>
          <span className="tooltip">Предупреждения</span>
        </div>
      </div>
    </div>
  );
};

export default BottomToolbar;
