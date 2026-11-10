import { createRoot } from 'react-dom/client';
import App from './App';
import { getEngine } from './engine/Engine';
import { consumeTransfer } from './store/transfer';
import './styles.css';

consumeTransfer();

getEngine(); // boot WebGL before React paints so the first frame is already cinematic
createRoot(document.getElementById('root')!).render(<App />);
