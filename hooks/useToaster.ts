
import { toast, ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const useToaster = () => {
  const showToast = (message: string, options: ToastOptions = {}) => {
    toast(message, {
      ...options,
      position: 'bottom-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  const showError = (message: string) => {
    showToast(message, { type: 'error' });
  };

  const showSuccess = (message: string) => {
    showToast(message, { type: 'success' });
  };

  const showInfo = (message: string) => {
    showToast(message, { type: 'info' });
  };

  const showWarning = (message: string) => {
    showToast(message, { type: 'warning' });
  };

  return {
    showToast,
    showError,
    showSuccess,
    showInfo,
    showWarning,
  };
};

export default useToaster;
