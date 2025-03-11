import React from 'react';
import { FileItem } from '../../types';

interface TerminalProps {
    style?: React.CSSProperties;
  }
const LeftBar: React.FC<TerminalProps> = ({ style }) => {
  const files: FileItem[] = [
    { name: 'src', isDirectory: true, path: '/src' },
    { name: 'public', isDirectory: true, path: '/public' },
    { name: 'index.html', isDirectory: false, path: '/index.html' },
  ];

  return (
    <div className="left-bar" style={style}>
      <div className="file-manager">
        <h3>EXPLORER</h3>
        <ul className="file-tree">
          {files.map((file) => (
            <li key={file.path}>
              {file.isDirectory ? '📁' : '📄'} {file.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LeftBar;