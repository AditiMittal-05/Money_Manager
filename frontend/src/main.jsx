import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'   // global CSS applied to every page

// This is where React "mounts" (attaches) itself to the HTML
// It takes the <div id="root"> from index.html and fills it with React
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
