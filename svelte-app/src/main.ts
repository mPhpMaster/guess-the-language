import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { exposeGlobalLogger, setupErrorLogging } from '$lib/services/errors';

// Install the error hooks before anything else so a failure during mount is
// still reported to `error_logs`.
exposeGlobalLogger();
setupErrorLogging();

const target = document.getElementById('app');
if (!target) throw new Error('#app mount point is missing');

export default mount(App, { target });
