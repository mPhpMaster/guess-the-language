/* @refresh reload */
import { render } from 'solid-js/web';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

document.documentElement.classList.add(
    window.location.pathname.startsWith('/.proxy') ? 'platform-discord' : 'platform-web',
);

// Register the service worker so the web build is an installable PWA that also
// works offline. Skipped on file:// (Electron) and in iframes (Discord).
if (
    'serviceWorker' in navigator &&
    window.location.protocol.startsWith('http') &&
    window.top === window.self
) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
}

render(() => <App />, root);
