import React from 'react';
import { TodoItem } from '../types';

interface TodoListItemProps {
  item: TodoItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TodoListItem: React.FC<TodoListItemProps> = ({ item, onToggle, onDelete }) => {
  return (
    <div className={`flex items-center justify-between p-4 mb-2 bg-white rounded-lg shadow-sm border-l-4 transition-all ${item.isCompleted ? 'border-green-500 opacity-70' : 'border-blue-500'}`}>
      <div className="flex items-center flex-1 gap-3 overflow-hidden">
        <input
          type="checkbox"
          checked={item.isCompleted}
          onChange={() => onToggle(item.id)}
          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
        />
        <span className={`text-lg truncate ${item.isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}`}>
          {item.content}
        </span>
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="ml-4 text-gray-400 hover:text-red-500 transition-colors p-1"
        aria-label="Delete task"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};