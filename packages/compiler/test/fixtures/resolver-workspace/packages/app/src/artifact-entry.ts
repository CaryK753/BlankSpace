import './artifact-style.css';
import logoUrl from './artifact-logo.svg?url';
import wasmUrl from './artifact-module.wasm?url';
import { virtualValue } from 'virtual:blankspace-s3';

const worker = new Worker(new URL('./artifact-worker.ts', import.meta.url), { type: 'module' });

console.log({ logoUrl, wasmUrl, virtualValue, worker });
