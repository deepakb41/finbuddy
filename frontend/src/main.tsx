import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply saved theme BEFORE React renders to avoid flash
const _t = localStorage.getItem('finbuddy_theme');
if (_t === 'dark') document.documentElement.classList.add('dark');
if (_t === 'pink') document.documentElement.classList.add('pink');

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
