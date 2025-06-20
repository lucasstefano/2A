import React, { useState, useRef, useEffect } from 'react';
import presente from '../../assets/presente.png';
import gatinho from '../../assets/gato.png';
import gatinho2 from '../../assets/gato2.png';
import gatinho3 from '../../assets/gatinho3.png';
import flata from '../../assets/flauta.png';
import amigo1 from '../../assets/amigo2.gif';
import amigo2 from '../../assets/amigo2.gif';
import amigo3 from '../../assets/amigo2.gif';
import amigo4 from '../../assets/amigo2.gif';
import confeteAudio from '../../assets/bongocat.mp4';
import cartaImg from '../../assets/cart.png';
import styled from 'styled-components';
import party from 'party-js';
import confetti from 'canvas-confetti';

const WhiteBackground = styled.div`
  height: 100vh;
  width: 100vw;
  background: white;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
`;

interface ImageButtonProps {
  flipped: boolean;
  scale?: number;
}

const ImageButton = styled.img<ImageButtonProps>`
  width: 300px;
  height: 300px;
  cursor: pointer;
  border-radius: 10px;
  transition: transform 0.1s linear;
  object-fit: contain;
  user-select: none;
  position: relative;
  z-index: 2;
  transform: ${({ flipped }) => (flipped ? 'scaleX(-1)' : 'scaleX(1)')};
`;

const FlataImage = styled.img<ImageButtonProps>`
  position: absolute;
  width: 250px;
  height: 250px;
  top: 45%;
  left: 50%;
  border-radius: 10px;
  user-select: none;
  pointer-events: none;
  z-index: 1;
  transform: ${({ scale = 1 }) => `translate(-15%, -50%) scale(${scale})`};
  transition: transform 0.1s linear;
`;

const FlataImage2 = styled.img<ImageButtonProps>`
  position: absolute;
  width: 250px;
  height: 250px;
  top: 45%;
  left: 50%;
  border-radius: 10px;
  user-select: none;
  pointer-events: none;
  z-index: 1;
  transform: ${({ scale = 1 }) =>
    `translate(-80%, -50%) scale(-1, 1) scale(${scale})`};
  transition: transform 0.1s linear;
`;

const AmigoGif = styled.img<{ position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }>`
  width: 120px;
  height: 120px;
  position: absolute;
  z-index: 1;
  ${({ position }) => {
    switch (position) {
      case 'top-left': return 'top: 10%; left: 10%;';
      case 'top-right': return 'top: 10%; right: 10%;';
      case 'bottom-left': return 'bottom: 10%; left: 10%;';
      case 'bottom-right': return 'bottom: 10%; right: 10%;';
    }
  }}
`;

const Carta = styled.img`
  position: absolute;
  bottom: 100px;
  width: 180px; /* aumentamos */
  height: auto;
  cursor: pointer;
  z-index: 3;
  transition: transform 0.3s ease;

  &:hover {
    transform: scale(1.2); /* cresce suavemente */
  }
`;
const CartaTexto = styled.div`
  position: absolute;
  bottom: 90px;
  font-size: 28px;
  font-weight: bold;
  color: #545353;
  z-index: 3;
  text-align: center;
  width: 100%;
`;

const TextoH1 = styled.div`
  font-size: 28px;
  font-weight: bold;
  color: #000000;
  z-index: 3;
  text-align: center;
  width: 100%;
`;

const TextoP = styled.div`
  font-size: 14px;
  color: #000000;
  z-index: 3;
  text-align: center;
  width: 100%;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 4;
`;

const ModalContent = styled.div`
  background: white;
  padding: 40px;
  border-radius: 12px;
  width: 80%;
  max-width: 500px;
  position: relative;
  text-align: center;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 15px;
  background: transparent;
  border: none;
  font-size: 24px;
  cursor: pointer;
`;

type Stage = 'initial' | 'gatinho' | 'gatinho2' | 'gatinho3';

const Page: React.FC = () => {
  const [clicked, setClicked] = useState(false);
  const [stage, setStage] = useState<Stage>('initial');
  const [flipped, setFlipped] = useState(false);
  const [showFlata, setShowFlata] = useState(false);
  const [flataScale, setFlataScale] = useState(1);
  const [showAmigos, setShowAmigos] = useState(false);
  const [showCarta, setShowCarta] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const effectsIntervalRef = useRef<number | null>(null);
  const stageRef = useRef<Stage>('initial');

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const threshold = 150;
  let lastBeatTime = 0;
  const minBeatGap = 300;

  const detectBeat = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const maxVolume = Math.max(...dataArrayRef.current);
    const now = performance.now();
    if (
      stageRef.current === 'gatinho3' &&
      maxVolume > threshold &&
      now - lastBeatTime > minBeatGap
    ) {
      lastBeatTime = now;
      setFlipped((prev) => !prev);
      setFlataScale(1.3);
      setTimeout(() => setFlataScale(1), 100);
    }
    animationFrameIdRef.current = requestAnimationFrame(detectBeat);
  };

  const playRandomEffects = () => {
    const effects = ['confetti', 'sparkles'] as const;
    const effect = effects[Math.floor(Math.random() * effects.length)];
    switch (effect) {
      case 'confetti':
        party.confetti(document.body, {
          count: party.variation.range(20, 40),
          spread: party.variation.range(20, 50),
          speed: party.variation.range(200, 400),
        });
        break;
      case 'sparkles':
        party.sparkles(document.body, {
          count: party.variation.range(10, 20),
        });
        break;
    }
  };

  const handleClick = () => {
    if (!clicked) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.8 } });

      if (audioRef.current) {
        audioRef.current.playbackRate = 1.0;
        audioRef.current.play().catch((e) => console.warn('Erro ao tocar:', e));
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtxRef.current.createMediaElementSource(audioRef.current);
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
        detectBeat();
      }

      setClicked(true);
      setStage('gatinho');
      setTimeout(() => setStage('gatinho2'), 8000);
      setTimeout(() => {
        setStage('gatinho3');
        setShowFlata(false);
      }, 12000);
      setTimeout(() => setShowFlata(true), 18000);
      setTimeout(() => {
        if (effectsIntervalRef.current) clearInterval(effectsIntervalRef.current);
        effectsIntervalRef.current = window.setInterval(playRandomEffects, 700);
      }, 8000);
      setTimeout(() => {
        setShowAmigos(true);
      }, 90000); // 3 minutos
      setTimeout(() => {
        setShowCarta(true);
      }, 15000); // 5 segundos após clique
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (effectsIntervalRef.current) clearInterval(effectsIntervalRef.current);
    };
  }, []);

  let currentImage: string;
  switch (stage) {
    case 'gatinho': currentImage = gatinho; break;
    case 'gatinho2': currentImage = gatinho2; break;
    case 'gatinho3': currentImage = gatinho3; break;
    default: currentImage = presente;
  }

  return (
    <WhiteBackground>
      {showFlata && stage === 'gatinho3' && (
        <>
          <FlataImage src={flata} alt="Flata atrás" flipped={flipped} scale={flataScale} />
          <FlataImage2 src={flata} alt="Flata atrás" flipped={flipped} scale={flataScale} />
        </>
      )}

      <ImageButton
        src={currentImage}
        alt="Imagem"
        onClick={handleClick}
        flipped={stage === 'gatinho3' ? flipped : false}
        draggable={false}
      />

      {(currentImage !== gatinho && currentImage !== gatinho2 && currentImage !== gatinho3) && (
        <CartaTexto>Clique AQUI!</CartaTexto>
      )}
      <audio ref={audioRef} src={confeteAudio} />

      {showAmigos && stage === 'gatinho3' && (
        <>
          <AmigoGif src={amigo1} position="top-left" />
          <AmigoGif src={amigo2} position="top-right" />
          <AmigoGif src={amigo3} position="bottom-left" />
          <AmigoGif src={amigo4} position="bottom-right" />
        </>
      )}

        {showCarta && (
        <>
          <Carta src={cartaImg} alt="Carta" onClick={() => setShowModal(true)} />
          <CartaTexto>Abra a Carta!</CartaTexto>
        </>
      )}

      {showModal && (
        <ModalOverlay onClick={() => setShowModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <CloseButton onClick={() => setShowModal(false)}>×</CloseButton>
           <TextoH1>Oi Anna 🐱!!</TextoH1>
           <TextoP> Mesmo depois de você ter me dito que estava melhor, ainda percebo uma diferença... e o seu sumiço. Mas não estou mandando isso pra você vir falar comigo, nem pra cobrar nenhuma explicação se ta tudo bem ou não.
            Só queria desejar, de coração, que independente do caminho que a vida tomar você fique bem.
          Talvez seja um pouco egoísmo meu querer te ver feliz, porque a sua felicidade também me faz bem.
          Enfim, quis deixar essa mensagem e te dizer que, mesmo com a distância, eu sempre vou estar por aqui se um dia quiser conversar.
          Fica com esses gatinhos dançando, pra tentar alegrar pelo menos 1% do seu dia. 🐱💛</TextoP>
                    </ModalContent>
        </ModalOverlay>
      )}
    </WhiteBackground>
  );
};

export default Page;
