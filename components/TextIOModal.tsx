import React, { useState } from 'react';

interface TextIOModalProps {
    title: string;
    initialValue: string;
    onSave?: (val: string) => void;
    onClose: () => void;
    mode: 'read' | 'write';
}

const TextIOModal: React.FC<TextIOModalProps> = ({ title, initialValue, onSave, onClose, mode }) => {
    const [value, setValue] = useState(initialValue);
    const [copySuccess, setCopySuccess] = useState(false);
  
    const handleCopy = () => {
      navigator.clipboard.writeText(value).then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
      });
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]" onClick={onClose}>
        <div className="bg-white p-6 rounded-lg shadow-xl w-[500px] flex flex-col space-y-4" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-lg">{title}</h3>
          <textarea
              className="w-full h-64 p-2 border border-gray-300 rounded font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={value}
              onChange={e => mode === 'read' && setValue(e.target.value)}
              readOnly={mode === 'write'}
              placeholder={mode === 'read' ? "Paste JSON here..." : ""}
          />
          <div className="flex justify-end space-x-2">
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Close</button>
              {mode === 'write' ? (
                  <button onClick={handleCopy} className={`px-4 py-2 rounded text-white ${copySuccess ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}>
                      {copySuccess ? "Copied!" : "Copy to Clipboard"}
                  </button>
              ) : (
                  <button onClick={() => onSave && onSave(value)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded">
                      Import
                  </button>
              )}
          </div>
        </div>
      </div>
    );
  };

export default TextIOModal;
