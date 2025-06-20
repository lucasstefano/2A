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
import styled, { keyframes } from 'styled-components';
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

const ImageButton = styled.img<{ flipped: boolean }>`
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

const FlataImage = styled.img<{ scale?: number }>`
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

const FlataImage2 = styled.img<{ scale?: number }>`
  position: absolute;
  width: 250px;
  height: 250px;
  top: 45%;
  left: 50%;
  border-radius: 10px;
  user-select: none;
  pointer-events: none;
  z-index: 1;
  transform: ${({ scale = 1 }) => `translate(-80%, -50%) scale(-1, 1) scale(${scale})`};
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

const fadeOut = keyframes`
  0% { opacity: 1; }
  90% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-10px); }
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


const ChatContainer = styled.div`
  position: absolute;
  bottom: 120px;
  max-width: 80%;
  padding: 20px;
  border-radius: 12px;

  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const MessageBubble = styled.div`
  align-self: flex-end;
  background: #dcf8c6;
  color: #333;
  padding: 10px 15px;
  border-radius: 20px;
  max-width: 80%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  font-size: 15px;
  white-space: pre-line;
  animation: ${fadeOut} 10s forwards;
`;

type Stage = 'initial' | 'gatinho' | 'gatinho2' | 'gatinho3';

const Page: React.FC = () => {
  const [clicked, setClicked] = useState(false);
  const [stage, setStage] = useState<Stage>('initial');
  const [flipped, setFlipped] = useState(false);
  const [showFlata, setShowFlata] = useState(false);
  const [flataScale, setFlataScale] = useState(1);
  const [showAmigos, setShowAmigos] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const effectsIntervalRef = useRef<number | null>(null);
  const stageRef = useRef<Stage>('initial');

const allMessages = [
    'Oi Anna 🐱',
    'Mesmo depois de você ter me dito que estava melhor, ainda notei sua ausência.',
    'Não estou te cobrando atenção, nem esperando que fale comigo, não é isso.',
    'Só queria te desejar, de coração, que fique tudo bem, idependente se tem alguma coisa ou não.',
    'Espero que seus dias sejam sempre leves e bons.',
    'Mesmo que eu não consiga estar sempre pra perturbar...',
    'E Mesmo que você queira um momento só seu, tudo bem também.',
    'Só espero que esse gatinho dançando te faça sorrir sempre que estiver se sentindo pra baixo.',
    'Sua felicidade me faz bem também.',
    'Sempre vou estar por aqui se um dia quiser conversar.',
    'Fica bem, tá? 💛',
    'Sim, essa foi a Mensagem Mais Carro de Som e Brega possivel! Por isso é bom.',
  ];


  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    if (showChat && currentMsgIndex < allMessages.length) {
      setIsTyping(true);
      const delay = setTimeout(() => {
        setChatMessages((prev) => [...prev, allMessages[currentMsgIndex]]);
        setCurrentMsgIndex((prev) => prev + 1);
        setIsTyping(false);
      }, 3000);
      return () => clearTimeout(delay);
    }
  }, [currentMsgIndex, showChat]);

  const threshold = 150;
  let lastBeatTime = 0;
  const minBeatGap = 300;

  const detectBeat = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const maxVolume = Math.max(...dataArrayRef.current);
    const now = performance.now();
    if (stageRef.current === 'gatinho3' && maxVolume > threshold && now - lastBeatTime > minBeatGap) {
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
      }, 22000);
      setTimeout(() => {
        setShowChat(true);
      }, 15000);
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (effectsIntervalRef.current) clearInterval(effectsIntervalRef.current);
      if (audioRef.current) audioRef.current.pause();
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
          <FlataImage src={flata} alt="Flata atrás" scale={flataScale} />
          <FlataImage2 src={flata} alt="Flata atrás" scale={flataScale} />
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
        <CartaTexto>Clique no Presente!</CartaTexto>
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

      {showChat && (
        <ChatContainer>
          {chatMessages.map((msg, i) => (
            <MessageBubble key={i}>{msg}</MessageBubble>
          ))}
          {isTyping && (
            <MessageBubble><i>digitando...</i></MessageBubble>
          )}
        </ChatContainer>
      )}
    </WhiteBackground>
  );
};

export default Page;