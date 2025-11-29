# Orbital//Void

<p align="center">
  <img 
    src="https://raw.githubusercontent.com/ericmaddox/orbital-void/main/media/screenshot1.png" 
    alt="Orbital//Void Gameplay Screenshot" 
    width="650"
    style="border-radius: 12px;"
  />
</p>

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
- **Pause**: Click the Pause button or press `P`  
- **Restart**: Press `R` or click the Restart button  

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

- **Upgrade Attack Early**: "Upgrade Attack early if you don't want to suck"  
- **Balance Your Build** – defense and mobility matter  
- **Use Obstacles** – line-of-sight blocking is powerful  
- **Kiting** – keep moving to avoid being overwhelmed  
- **Buy All Button** – rapid scaling for attack upgrades  

## Technical Details

- Built with vanilla JavaScript and HTML5 Canvas  
- Real-time physics and collision detection  
- Particle system for visual effects  
- Local storage for save data  
- Optimized to run at 60 FPS  

## UI Elements

### HUD
- Wave Counter  
- Gold  
- Game State (Running / Paused / Game Over)  
- HP Bar with numeric value  
- Live ship stats  

### Sidebar
- Upgrade Bay  
- Element Legend  
- Event Log  
- Save Toggle  

## Files

- `index.html` — Game structure and UI layout  
- `styles.css` — Styling and visual design  
- `script.js` — Full game engine logic  

## Browser Compatibility

Requires a modern browser supporting:  
- HTML5 Canvas  
- ES6+ JavaScript  
- Local Storage  
- requestAnimationFrame  

## Performance

The game is optimized through:  
- Capped particle effects  
- Limited bullet count  
- Efficient collision detection  
- Reduced overdraw and optimized rendering pipeline  

