import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// WebView2 restores the scroll position of the previous session a moment after
// load, which would drop the user into the middle of the form. Reset it on the
// first frame and once the restore has certainly happened.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const toTop = () => window.scrollTo(0, 0);
toTop();
requestAnimationFrame(toTop);
window.addEventListener('load', toTop, { once: true });
window.setTimeout(toTop, 180);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
