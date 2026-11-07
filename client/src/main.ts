import './style.css';
import { watchTouchDevice } from './input/device';
import { InputManager } from './input/inputManager';
import { KeyboardSource } from './input/keyboard';
import { DPad } from './ui/dpad';
import { lockTouchScroll } from './ui/touchLock';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<div id="world" class="fixed inset-0"></div>';

lockTouchScroll();

const dpad = new DPad();
document.body.appendChild(dpad.element);
const input = new InputManager([new KeyboardSource(), dpad]);
watchTouchDevice((isTouch) => dpad.setVisible(isTouch));

void import('./world/bootWorld').then((m) => m.bootWorld(document.querySelector('#world')!, () => input.getAxis()));
