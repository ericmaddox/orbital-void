# Orbital//Void

A fast-paced, top-down space shooter with wave-based combat, upgrade systems, and persistent progression. Defend against increasingly difficult waves of enemies while upgrading your ship's capabilities.

## Features

- **Wave-Based Combat**: Survive increasingly difficult enemy waves
- **Upgrade System**: Enhance your ship with multiple upgrade paths
  - Attack damage
  - Fire rate
  - Armor (damage reduction)
  - Movement speed
- **Multiple Enemy Types**:
  - Basic enemies (red)
  - Heavy enemies (yellow) - more HP
  - Ranged enemies (purple) - shoot back
- **Persistent Progression**: Gold and upgrades save to local storage
- **Dynamic Obstacles**: Navigate around destructible barriers
- **Performance Optimized**: Capped particles and bullets for smooth gameplay
- **Audio Controls**: Mute/unmute sound effects

## Gameplay

### Objective

Survive as many waves as possible while earning gold to purchase upgrades. Each wave increases in difficulty with more enemies and tougher variants.

### Controls

- **Movement**: WASD or Arrow keys
- **Shooting**: Automatic (fires toward mouse cursor)
- **Pause**: Click the Pause button or press P
- **Restart**: Press R or click the Restart button

### Game Mechanics

#### Combat
- Your ship automatically shoots toward your mouse cursor
- Enemies spawn in waves with increasing difficulty
- Destroy enemies to earn gold
- Avoid enemy projectiles and collisions

#### Upgrades
- **Attack**: Increase bullet damage
- **Fire Rate**: Shoot more bullets per second
- **Armor**: Reduce incoming damage by a percentage
- **Speed**: Move faster to dodge enemies

#### Progression
- Gold earned from defeating enemies
- Upgrades persist between sessions (if save is enabled)
- Each wave introduces more enemies
- Enemy variety increases as you progress

## Strategy Tips

- **Upgrade Attack Early**: The description says it all - "upgrade Attack early if you dont want to suck"
- **Balance Your Build**: Don't neglect defense (armor) and mobility (speed)
- **Use Obstacles**: Hide behind barriers to avoid enemy fire
- **Kiting**: Keep moving to avoid getting surrounded
- **Buy All Button**: Quick-purchase attack upgrades for rapid power scaling

## Technical Details

- Built with vanilla JavaScript and HTML5 Canvas
- Real-time physics and collision detection
- Particle system for visual effects
- Local storage for save data
- Performance optimizations for smooth 60 FPS gameplay

## UI Elements

### HUD
- **Wave Counter**: Current wave number
- **Gold**: Available currency for upgrades
- **Status**: Game state (Running/Paused/Game Over)
- **HP Bar**: Visual health indicator with numeric display
- **Live Stats**: Real-time display of current ship stats

### Sidebar
- **Upgrade Bay**: Purchase and view all available upgrades
- **Legend**: Visual guide to game elements
- **Event Log**: Recent game events and notifications
- **Save Toggle**: Enable/disable persistent progression

## Files

- `index.html` - Game structure and UI layout
- `styles.css` - Game styling and visual design
- `script.js` - Game engine, logic, and mechanics

## Browser Compatibility

Requires a modern browser with support for:
- HTML5 Canvas
- ES6+ JavaScript
- Local Storage API
- RequestAnimationFrame

## Performance

The game is optimized for performance with:
- Capped particle effects
- Limited bullet count
- Efficient collision detection
- Optimized rendering pipeline
