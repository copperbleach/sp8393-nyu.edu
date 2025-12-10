import React from 'react';

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  id: string;
  children: React.ReactNode;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ checked, onChange, id, children }) => (
    <label htmlFor={id} className="flex items-center cursor-pointer">
        <input 
            type="checkbox" 
            id={id} 
            checked={checked} 
            onChange={onChange}
            className="absolute opacity-0 w-0 h-0"
        />
        <span className={`w-5 h-5 border rounded-sm flex items-center justify-center mr-1.5 transition-colors ${checked ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-400'}`}>
            {checked && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </span>
        {children}
    </label>
);

export default CustomCheckbox;
