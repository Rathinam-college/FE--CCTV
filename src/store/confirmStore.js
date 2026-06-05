import { create } from 'zustand';

export const useConfirmStore = create((set) => ({
  isOpen: false,
  message: '',
  subMessage: '',
  onConfirm: null,
  showConfirm: (message, onConfirm, subMessage = 'This action cannot be undone.') => set({ 
    isOpen: true, 
    message, 
    subMessage,
    onConfirm 
  }),
  closeConfirm: () => set({ isOpen: false, message: '', subMessage: '', onConfirm: null })
}));
