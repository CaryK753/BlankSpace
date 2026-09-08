import '@fontsource-variable/inter';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.js';
import type {ContributionSet} from './model.js';
import './styles.css';

declare const __S8_CONTRIBUTIONS__: ContributionSet;
const contributions = __S8_CONTRIBUTIONS__;
if (!contributions) throw new Error('S8 contribution payload is missing.');
const root = document.getElementById('root');
if (!root) throw new Error('S8 root is missing.');
createRoot(root).render(<StrictMode><App contributions={contributions}/></StrictMode>);
