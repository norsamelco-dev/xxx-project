import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeProvider'
import './style.css'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(
      BrowserRouter,
      null,
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(AuthProvider, null, React.createElement(App)),
      ),
    ),
  ),
)
