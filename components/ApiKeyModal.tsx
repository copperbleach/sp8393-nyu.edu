import React, { useState, useEffect, useRef } from 'react';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
  onClose: () => void;
}
  
const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, onClose }) => {
  const [key, setKey] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (key.trim()) {
      onSave(key.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]" onClick={onClose}>
      <div className="bg-white p-6 rounded-lg shadow-xl w-96 flex flex-col space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg">Add Google Gemini API Key</h3>
        <p className="text-sm text-gray-600">Your key is stored only in your browser and is required for AI features.</p>
        <div className="flex items-center space-x-2">
          <input 
            ref={inputRef}
            type="password"
            className="flex-grow p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your API key..."
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button 
            onClick={handleSave} 
            className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center justify-center aspect-square"
            title="Accept"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
