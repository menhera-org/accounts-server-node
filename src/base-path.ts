
import path from 'node:path';
import * as url from 'node:url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export const BASE_PATH = path.resolve(__dirname, '..');

export const STATIC_DIR = path.resolve(BASE_PATH, 'static');

export const ASSETS_DIR = path.resolve(BASE_PATH, 'assets');
