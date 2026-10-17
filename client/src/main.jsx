import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/300-italic.css';
import './styles.css';
import './theme.css';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { MetaProvider } from './meta.jsx';
import { ToastProvider } from './components/Toast.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MetaProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </MetaProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
