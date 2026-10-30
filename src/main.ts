import './ui/styles/main.css';
import { App } from './app/App';

const root = document.getElementById('app');
const boot = document.getElementById('boot');
if (root) {
  new App(root);
  boot?.remove();
}
