import {createRoot} from 'react-dom/client';
import CharacterSheet from '../app/character-sheet';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(<CharacterSheet />);
