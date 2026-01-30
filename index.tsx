import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';

// Context Providers
import { AppProvider } from './core/state/AppContext';
import { DataContextProvider } from './core/state/DataContext';

// The Main App Component (which uses MainLayout)
import App from './App';

// Styles
import './index.css';

/**
 * THE FIX:
 * MainLayout.tsx uses useLocation() and useNavigate().
 * These hooks only work if the component is inside a <Router>.
 * Wrapping <App /> here solves the "Uncaught Error" immediately.
 */

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 6,
          },
        }}
      >
        <AppProvider>
          <DataContextProvider>
            <Router>
              <App />
            </Router>
          </DataContextProvider>
        </AppProvider>
      </ConfigProvider>
    </React.StrictMode>
  );
}