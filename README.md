# `first-person-shooter`

A first-person shooter game foundation made with [LUME](https://lume.io/),
[Solid.js](https://solidjs.com/) (and libs), and
[Meteor](https://www.meteor.com/).

LUMECraft's `first-person-shooter` aims to be an open-source starting point for
FPS games written declaratively using LUME's 3D HTML elements with Solid.js
templating and reactivity, and realtime multiplayer connectivity powered by
Meteor.js. Eventually it will be skinnable, moddable, and more.

## Mobile support

This fork is **mobile-ready**:

- **Virtual joystick** (bottom-left) for movement
- **Touch-drag** on the right half of the screen to look around
- **FIRE button** (bottom-right) to shoot
- Desktop mouse + keyboard (pointer lock + WASD) still work when not on a touch device
- Viewport meta and `touch-action: none` prevent page scroll/zoom while playing

## Run it

First [install the Meteor cli](https://www.meteor.com/developers/install) along with [Node.js](https://nodejs.org).

Then:

```
npm install
npm start
```

Open the printed URL on a phone or use Chrome DevTools device mode to test touch controls.
