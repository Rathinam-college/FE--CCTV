import { useEffect } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export const useActivityLogger = (pageName) => {
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user && pageName) {
      const logPageView = async () => {
        try {
          await api.post('/cameras/logs/', {
            action: 'VIEW',
            page: pageName,
            details: `User accessed the ${pageName} page.`
          });
        } catch (err) {
          console.error('Failed to log page view:', err);
        }
      };

      logPageView();
    }
  }, [pageName, isAuthenticated, user]);
};
