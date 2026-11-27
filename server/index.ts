import { config } from './config.js';
import app from './app.js';

app.listen(config.port, () => console.log(`API server on :${config.port} (${config.mock ? 'MOCK mode' : `sandbox, auth=${config.authMode}`})`));
