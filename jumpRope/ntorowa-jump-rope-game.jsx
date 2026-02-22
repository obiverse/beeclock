import React, { useState, useEffect, useCallback, useRef } from 'react';

const GAME_WIDTH = 400;
const GAME_HEIGHT = 500;
const GROUND_Y = 420;
const ROPE_TURNER_WIDTH = 60;
const JUMPER_SIZE = 50;
const ROPE_HEIGHT_VARIANCE = 120;

// Kente-inspired color palette
const COLORS = {
  gold: '#D4AF37',
  orange: '#E85D04',
  green: '#2D6A4F',
  red: '#9B2226',
  black: '#1B1B1B',
  cream: '#F5F0E1',
  sky: '#87CEEB',
  earth: '#8B4513',
  purple: '#7B2D8E'
};

export default function NtorowaJumpRope() {
  const [gameState, setGameState] = useState('menu'); // menu, playing, paused, gameOver
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [jumperY, setJumperY] = useState(GROUND_Y);
  const [isJumping, setIsJumping] = useState(false);
  const [ropeAngle, setRopeAngle] = useState(0);
  const [bpm, setBpm] = useState(80);
  const [lastJumpTiming, setLastJumpTiming] = useState(null);
  const [particles, setParticles] = useState([]);
  const [difficulty, setDifficulty] = useState(1);
  const [turnerAnimation, setTurnerAnimation] = useState(0);
  
  const gameLoopRef = useRef(null);
  const jumpVelocityRef = useRef(0);
  const lastTimeRef = useRef(0);

  // Calculate rope position based on angle
  const getRopeY = useCallback(() => {
    // Rope swings in a circular motion
    const normalizedAngle = ropeAngle % (Math.PI * 2);
    const ropeHeight = Math.sin(normalizedAngle) * ROPE_HEIGHT_VARIANCE;
    return GROUND_Y - 30 + ropeHeight;
  }, [ropeAngle]);

  // Check collision between jumper and rope
  const checkCollision = useCallback(() => {
    const ropeY = getRopeY();
    const jumperBottom = jumperY + JUMPER_SIZE;
    const jumperTop = jumperY;
    
    // Rope is dangerous when it's near ground level (coming down or going up through jump zone)
    const normalizedAngle = ropeAngle % (Math.PI * 2);
    const ropeIsLow = normalizedAngle > Math.PI * 0.8 && normalizedAngle < Math.PI * 1.2;
    
    if (ropeIsLow && ropeY > jumperTop && ropeY < jumperBottom + 20) {
      return true;
    }
    return false;
  }, [getRopeY, jumperY, ropeAngle]);

  // Scoring based on jump timing
  const scoreJump = useCallback(() => {
    const normalizedAngle = ropeAngle % (Math.PI * 2);
    const perfectZone = Math.abs(normalizedAngle - Math.PI) < 0.3;
    const goodZone = Math.abs(normalizedAngle - Math.PI) < 0.6;
    
    let points = 10;
    let timing = 'ok';
    
    if (perfectZone) {
      points = 100;
      timing = 'perfect';
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
    } else if (goodZone) {
      points = 50;
      timing = 'good';
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
    } else {
      setCombo(0);
    }
    
    const multiplier = Math.floor(combo / 5) + 1;
    setScore(s => s + points * multiplier);
    setLastJumpTiming(timing);
    
    // Create particles for visual feedback
    if (timing === 'perfect') {
      createParticles(GAME_WIDTH / 2, jumperY, COLORS.gold, 10);
    } else if (timing === 'good') {
      createParticles(GAME_WIDTH / 2, jumperY, COLORS.green, 5);
    }
    
    setTimeout(() => setLastJumpTiming(null), 500);
  }, [ropeAngle, combo, jumperY]);

  // Create particle effects
  const createParticles = (x, y, color, count) => {
    const newParticles = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Date.now() + i,
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 3,
        color,
        life: 1
      });
    }
    setParticles(p => [...p, ...newParticles]);
  };

  // Jump function
  const jump = useCallback(() => {
    if (!isJumping && gameState === 'playing') {
      setIsJumping(true);
      jumpVelocityRef.current = -15;
      scoreJump();
    }
  }, [isJumping, gameState, scoreJump]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = (timestamp) => {
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      
      // Update rope angle based on BPM
      const ropeSpeed = (bpm / 60) * Math.PI * 2 * (deltaTime / 1000);
      setRopeAngle(a => a + ropeSpeed);
      
      // Update turner animation
      setTurnerAnimation(t => (t + deltaTime * 0.01) % (Math.PI * 2));
      
      // Update jumper physics
      if (isJumping) {
        jumpVelocityRef.current += 0.8; // Gravity
        setJumperY(y => {
          const newY = y + jumpVelocityRef.current;
          if (newY >= GROUND_Y) {
            setIsJumping(false);
            jumpVelocityRef.current = 0;
            return GROUND_Y;
          }
          return newY;
        });
      }
      
      // Update particles
      setParticles(prevParticles => 
        prevParticles
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.2,
            life: p.life - 0.02
          }))
          .filter(p => p.life > 0)
      );
      
      // Check collision
      if (checkCollision() && !isJumping) {
        setGameState('gameOver');
        return;
      }
      
      // Increase difficulty over time
      if (score > 0 && score % 500 === 0) {
        setBpm(b => Math.min(b + 5, 160));
        setDifficulty(d => d + 1);
      }
      
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    lastTimeRef.current = performance.now();
    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, isJumping, bpm, checkCollision, score]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (gameState === 'menu') {
          startGame();
        } else if (gameState === 'playing') {
          jump();
        } else if (gameState === 'gameOver') {
          startGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, jump]);

  const startGame = () => {
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setBpm(80);
    setDifficulty(1);
    setJumperY(GROUND_Y);
    setRopeAngle(0);
    setIsJumping(false);
    setParticles([]);
    setGameState('playing');
  };

  // Render rope turner character
  const RopeTurner = ({ side, animation }) => {
    const x = side === 'left' ? 30 : GAME_WIDTH - 30;
    const armSwing = Math.sin(animation) * 15;
    
    return (
      <g transform={`translate(${x}, ${GROUND_Y - 60})`}>
        {/* Body */}
        <ellipse cx="0" cy="30" rx="15" ry="20" fill={COLORS.orange} />
        {/* Head */}
        <circle cx="0" cy="0" r="18" fill={COLORS.earth} />
        {/* Hair/Head wrap */}
        <ellipse cx="0" cy="-8" rx="16" ry="10" fill={COLORS.purple} />
        {/* Eyes */}
        <circle cx="-6" cy="-2" r="3" fill="white" />
        <circle cx="6" cy="-2" r="3" fill="white" />
        <circle cx="-6" cy="-2" r="1.5" fill={COLORS.black} />
        <circle cx="6" cy="-2" r="1.5" fill={COLORS.black} />
        {/* Smile */}
        <path d="M -6 6 Q 0 12 6 6" stroke={COLORS.black} strokeWidth="2" fill="none" />
        {/* Arms */}
        <line 
          x1={side === 'left' ? 10 : -10} 
          y1="20" 
          x2={side === 'left' ? 25 + armSwing : -25 - armSwing} 
          y2="10" 
          stroke={COLORS.earth} 
          strokeWidth="8" 
          strokeLinecap="round"
        />
        {/* Legs */}
        <line x1="-8" y1="50" x2="-8" y2="80" stroke={COLORS.black} strokeWidth="8" strokeLinecap="round" />
        <line x1="8" y1="50" x2="8" y2="80" stroke={COLORS.black} strokeWidth="8" strokeLinecap="round" />
        {/* Feet */}
        <ellipse cx="-8" cy="85" rx="10" ry="5" fill={COLORS.red} />
        <ellipse cx="8" cy="85" rx="10" ry="5" fill={COLORS.red} />
      </g>
    );
  };

  // Render jumper character
  const Jumper = ({ y }) => {
    const squash = isJumping ? 0.8 : 1;
    const stretch = isJumping ? 1.2 : 1;
    
    return (
      <g transform={`translate(${GAME_WIDTH / 2}, ${y})`}>
        {/* Shadow */}
        <ellipse 
          cx="0" 
          cy={GROUND_Y - y + 5} 
          rx={20 * (1 - (GROUND_Y - y) / 200)} 
          ry={5 * (1 - (GROUND_Y - y) / 200)} 
          fill="rgba(0,0,0,0.3)" 
        />
        {/* Body */}
        <g transform={`scale(${squash}, ${stretch})`}>
          <ellipse cx="0" cy="25" rx="18" ry="22" fill={COLORS.green} />
          {/* Head */}
          <circle cx="0" cy="-5" r="20" fill={COLORS.earth} />
          {/* Hair */}
          <ellipse cx="0" cy="-18" rx="18" ry="12" fill={COLORS.black} />
          {/* Eyes */}
          <circle cx="-7" cy="-8" r="4" fill="white" />
          <circle cx="7" cy="-8" r="4" fill="white" />
          <circle cx="-7" cy="-8" r="2" fill={COLORS.black} />
          <circle cx="7" cy="-8" r="2" fill={COLORS.black} />
          {/* Expression */}
          {isJumping ? (
            <path d="M -8 4 Q 0 12 8 4" stroke={COLORS.black} strokeWidth="2" fill="none" />
          ) : (
            <ellipse cx="0" cy="5" rx="6" ry="4" fill={COLORS.black} />
          )}
          {/* Arms */}
          <line x1="-18" y1="15" x2="-30" y2={isJumping ? -5 : 25} stroke={COLORS.earth} strokeWidth="8" strokeLinecap="round" />
          <line x1="18" y1="15" x2="30" y2={isJumping ? -5 : 25} stroke={COLORS.earth} strokeWidth="8" strokeLinecap="round" />
          {/* Legs */}
          <line x1="-8" y1="45" x2="-12" y2={isJumping ? 55 : 70} stroke={COLORS.earth} strokeWidth="8" strokeLinecap="round" />
          <line x1="8" y1="45" x2="12" y2={isJumping ? 55 : 70} stroke={COLORS.earth} strokeWidth="8" strokeLinecap="round" />
        </g>
      </g>
    );
  };

  // Render the rope
  const Rope = () => {
    const ropeY = getRopeY();
    const normalizedAngle = ropeAngle % (Math.PI * 2);
    const opacity = normalizedAngle > Math.PI ? 0.8 : 1;
    const strokeWidth = normalizedAngle > Math.PI ? 4 : 6;
    
    // Create rope curve
    const leftX = 55;
    const rightX = GAME_WIDTH - 55;
    const midX = GAME_WIDTH / 2;
    const controlY = ropeY - 30;
    
    return (
      <g opacity={opacity}>
        <path
          d={`M ${leftX} ${GROUND_Y - 40} Q ${midX} ${ropeY} ${rightX} ${GROUND_Y - 40}`}
          stroke={COLORS.gold}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* Rope highlights */}
        <path
          d={`M ${leftX} ${GROUND_Y - 40} Q ${midX} ${ropeY} ${rightX} ${GROUND_Y - 40}`}
          stroke={COLORS.orange}
          strokeWidth={strokeWidth - 2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="10,20"
        />
      </g>
    );
  };

  // Background with African-inspired patterns
  const Background = () => (
    <g>
      {/* Sky gradient */}
      <defs>
        <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="50%" stopColor="#16213e" />
          <stop offset="100%" stopColor="#e94560" />
        </linearGradient>
        <linearGradient id="groundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={COLORS.earth} />
          <stop offset="100%" stopColor="#5D3A1A" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={GAME_WIDTH} height={GAME_HEIGHT} fill="url(#skyGradient)" />
      
      {/* Stars */}
      {[...Array(20)].map((_, i) => (
        <circle 
          key={i} 
          cx={Math.random() * GAME_WIDTH} 
          cy={Math.random() * 200} 
          r={Math.random() * 2 + 0.5} 
          fill="white" 
          opacity={Math.random() * 0.5 + 0.5}
        />
      ))}
      
      {/* Ground */}
      <rect x="0" y={GROUND_Y + 25} width={GAME_WIDTH} height={GAME_HEIGHT - GROUND_Y - 25} fill="url(#groundGradient)" />
      
      {/* Kente pattern border */}
      <g>
        {[...Array(8)].map((_, i) => (
          <rect
            key={i}
            x={i * 50}
            y={GROUND_Y + 20}
            width="25"
            height="10"
            fill={i % 2 === 0 ? COLORS.gold : COLORS.red}
          />
        ))}
        {[...Array(8)].map((_, i) => (
          <rect
            key={i + 'b'}
            x={i * 50 + 25}
            y={GROUND_Y + 20}
            width="25"
            height="10"
            fill={i % 2 === 0 ? COLORS.green : COLORS.black}
          />
        ))}
      </g>
    </g>
  );

  // UI Elements
  const GameUI = () => (
    <g>
      {/* Score */}
      <text x="20" y="35" fill={COLORS.gold} fontSize="24" fontWeight="bold" fontFamily="Georgia, serif">
        {score}
      </text>
      
      {/* Combo */}
      {combo > 2 && (
        <text x="20" y="60" fill={COLORS.orange} fontSize="16" fontFamily="Georgia, serif">
          {combo}x Combo!
        </text>
      )}
      
      {/* BPM indicator */}
      <text x={GAME_WIDTH - 20} y="35" fill={COLORS.cream} fontSize="14" textAnchor="end" fontFamily="monospace">
        {bpm} BPM
      </text>
      
      {/* Jump timing feedback */}
      {lastJumpTiming && (
        <text 
          x={GAME_WIDTH / 2} 
          y={jumperY - 60} 
          fill={lastJumpTiming === 'perfect' ? COLORS.gold : lastJumpTiming === 'good' ? COLORS.green : COLORS.cream}
          fontSize={lastJumpTiming === 'perfect' ? '28' : '20'}
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="Georgia, serif"
        >
          {lastJumpTiming.toUpperCase()}!
        </text>
      )}
    </g>
  );

  // Menu Screen
  const MenuScreen = () => (
    <g>
      <rect x="0" y="0" width={GAME_WIDTH} height={GAME_HEIGHT} fill={COLORS.black} opacity="0.7" />
      
      {/* Title */}
      <text x={GAME_WIDTH / 2} y="120" fill={COLORS.gold} fontSize="42" fontWeight="bold" textAnchor="middle" fontFamily="Georgia, serif">
        NTOROWA
      </text>
      <text x={GAME_WIDTH / 2} y="155" fill={COLORS.cream} fontSize="16" textAnchor="middle" fontFamily="Georgia, serif">
        The Rhythm of Ropes
      </text>
      
      {/* Decorative kente pattern */}
      <g transform={`translate(${GAME_WIDTH/2 - 75}, 180)`}>
        {[...Array(6)].map((_, i) => (
          <rect key={i} x={i * 25} y="0" width="25" height="8" fill={[COLORS.gold, COLORS.red, COLORS.green, COLORS.black, COLORS.gold, COLORS.orange][i]} />
        ))}
      </g>
      
      {/* Instructions */}
      <text x={GAME_WIDTH / 2} y="250" fill={COLORS.cream} fontSize="18" textAnchor="middle" fontFamily="Georgia, serif">
        TAP or SPACE to Jump
      </text>
      <text x={GAME_WIDTH / 2} y="280" fill={COLORS.orange} fontSize="14" textAnchor="middle" fontFamily="Georgia, serif">
        Time your jumps to the rope rhythm
      </text>
      
      {/* Start prompt */}
      <text 
        x={GAME_WIDTH / 2} 
        y="380" 
        fill={COLORS.gold} 
        fontSize="22" 
        textAnchor="middle"
        fontFamily="Georgia, serif"
        style={{ cursor: 'pointer' }}
      >
        ▶ TAP TO START ◀
      </text>
    </g>
  );

  // Game Over Screen
  const GameOverScreen = () => (
    <g>
      <rect x="0" y="0" width={GAME_WIDTH} height={GAME_HEIGHT} fill={COLORS.black} opacity="0.8" />
      
      <text x={GAME_WIDTH / 2} y="120" fill={COLORS.red} fontSize="36" fontWeight="bold" textAnchor="middle" fontFamily="Georgia, serif">
        ROPE CAUGHT!
      </text>
      
      <text x={GAME_WIDTH / 2} y="200" fill={COLORS.gold} fontSize="48" fontWeight="bold" textAnchor="middle" fontFamily="Georgia, serif">
        {score}
      </text>
      <text x={GAME_WIDTH / 2} y="230" fill={COLORS.cream} fontSize="16" textAnchor="middle" fontFamily="Georgia, serif">
        FINAL SCORE
      </text>
      
      <text x={GAME_WIDTH / 2} y="290" fill={COLORS.orange} fontSize="20" textAnchor="middle" fontFamily="Georgia, serif">
        Best Combo: {maxCombo}x
      </text>
      
      <text x={GAME_WIDTH / 2} y="380" fill={COLORS.gold} fontSize="20" textAnchor="middle" fontFamily="Georgia, serif" style={{ cursor: 'pointer' }}>
        ▶ TAP TO RETRY ◀
      </text>
    </g>
  );

  const handleClick = () => {
    if (gameState === 'menu') {
      startGame();
    } else if (gameState === 'playing') {
      jump();
    } else if (gameState === 'gameOver') {
      startGame();
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '20px',
      fontFamily: 'Georgia, serif'
    }}>
      <h1 style={{ 
        color: COLORS.gold, 
        marginBottom: '10px',
        fontSize: '28px',
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
      }}>
        🌍 Ntorowa
      </h1>
      <p style={{ 
        color: COLORS.cream, 
        marginBottom: '20px',
        fontSize: '14px'
      }}>
        African Jump Rope Game
      </p>
      
      <svg 
        width={GAME_WIDTH} 
        height={GAME_HEIGHT}
        style={{ 
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          cursor: gameState === 'playing' ? 'pointer' : 'default',
          border: `4px solid ${COLORS.gold}`
        }}
        onClick={handleClick}
        onTouchStart={(e) => {
          e.preventDefault();
          handleClick();
        }}
      >
        <Background />
        
        {gameState === 'playing' && (
          <>
            <RopeTurner side="left" animation={turnerAnimation} />
            <RopeTurner side="right" animation={-turnerAnimation} />
            <Rope />
            <Jumper y={jumperY} />
            
            {/* Particles */}
            {particles.map(p => (
              <circle
                key={p.id}
                cx={p.x}
                cy={p.y}
                r={4 * p.life}
                fill={p.color}
                opacity={p.life}
              />
            ))}
            
            <GameUI />
          </>
        )}
        
        {gameState === 'menu' && <MenuScreen />}
        {gameState === 'gameOver' && <GameOverScreen />}
      </svg>
      
      <div style={{ 
        marginTop: '20px', 
        color: COLORS.cream,
        fontSize: '12px',
        textAlign: 'center'
      }}>
        <p>🎮 Keyboard: SPACE or ↑ to jump</p>
        <p>📱 Touch: Tap screen to jump</p>
      </div>
    </div>
  );
}
